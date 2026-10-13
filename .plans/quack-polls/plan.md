# Plán implementace: Anketa v quacku

Zadání: [user-story.md](user-story.md). Tento dokument říká **jak** story splnit v tomto repu, v jakém pořadí a jak každý krok ověřit. Vzorem je stávající feature quack (`apps/backend/src/modules/quack`, `apps/frontend/src/features/quack`) a pravidla v `CLAUDE.md` a `DESIGN.md`.

## 1. Klíčová rozhodnutí

| Otázka                                                | Rozhodnutí                                                                                                      | Proč                                                                                                                                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Samostatná tabulka `Poll`?                            | **Ano.** `Poll` je satelit quacku (1:1 přes `quackId @unique`), možnosti a hlasy visí na `pollId`.              | „Quack má anketu“ je explicitní řádek, ne odvozenina z existence možností. Hlas sémanticky patří anketě, ne quacku. Budoucí atributy (uzavření, lhůta) mají místo bez migrace. Cena je jeden join navíc. |
| Proč má hlas `pollId`, když ho má přes možnost?       | Záměrná redundance kvůli klíči `(pollId, userId)`.                                                              | Klíč `(userId, optionId)` by bránil jen dvojímu hlasu pro tutéž možnost, ne pro dvě možnosti jedné ankety.                                                                                               |
| Jak vynutit „jeden hlas“?                             | Složený primární klíč `(pollId, userId)` na `poll_vote` + `upsert`.                                             | Pravidlo drží databáze, ne aplikační logika. Souběžné požadavky skončí posledním zapsaným hlasem, nikdy dvěma.                                                                                           |
| Jak zaručit, že hlas míří na možnost **této** ankety? | Složený cizí klíč `(pollId, optionId) → poll_option(pollId, id)`.                                               | Bez toho může klient poslat `optionId` cizí ankety a redundantní `pollId` na hlasu by mohl lhát. Prisma to umí přes `@@unique([pollId, id])` na možnosti.                                                |
| Jaké id zná klient?                                   | Endpoint je `PUT /quacks/:id/vote` s id **quacku**.                                                             | Feed pracuje s quacky; `pollId` je interní detail, service si ho dohledá přes 1:1.                                                                                                                       |
| Kdo počítá procenta?                                  | Server vrací `votes` na možnost a `totalVotes`; procento je čistá UI funkce s jedním zaokrouhlovacím pravidlem. | Počty jsou pravda ze serveru (story bod 10). Procento je odvozenina, kterou netřeba přenášet.                                                                                                            |
| Vrací server počty i tomu, kdo nehlasoval?            | **Ano**, vždy. UI je skryje, dokud `myOptionId` je `null`.                                                      | Jednodušší typy a cache. Počty nejsou citlivé; nahlédnutí přes devtools nevadí (story bod 3 řeší UX, ne bezpečnost).                                                                                     |
| Odpověď na hlasování?                                 | Celý `QuackResponseDto` (stejný tvar jako položka feedu).                                                       | Klient jen vymění položku v cache seznamu, žádné sčítání na klientu.                                                                                                                                     |
| Optimistický update?                                  | **Ne.** `isPending` zablokuje možnosti, výsledky až z odpovědi.                                                 | Rozhodnutí zadavatele (story bod 7).                                                                                                                                                                     |

## 2. Datový model a migrace

Soubor: `apps/backend/prisma/schema.prisma`

```prisma
model Quack {
  // ...stávající pole...
  poll Poll?   // null = obyčejný quack
}

// Satelit quacku. Dnes nese jen vazby; uzavření nebo lhůta by přibyly sem.
model Poll {
  id        String       @id @default(cuid())
  quack     Quack        @relation(fields: [quackId], references: [id], onDelete: Cascade)
  quackId   String       @unique       // 1:1
  createdAt DateTime     @default(now())
  options   PollOption[]
  votes     PollVote[]

  @@map("poll")
}

model PollOption {
  id       String @id @default(cuid())
  poll     Poll   @relation(fields: [pollId], references: [id], onDelete: Cascade)
  pollId   String
  text     String @db.VarChar(50)
  position Int    // 0..3, pořadí jak autor možnosti zadal
  votes    PollVote[]

  @@unique([pollId, id])         // cíl složeného FK z PollVote
  @@unique([pollId, position])
  @@map("poll_option")
}

model PollVote {
  poll      Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  pollId    String     // redundantní vůči option.pollId – záměrně, kvůli @@id níže
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  option    PollOption @relation(fields: [pollId, optionId], references: [pollId, id], onDelete: Cascade)
  optionId  String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @default(now()) @updatedAt

  @@id([pollId, userId])          // jeden účet = jeden hlas na anketu
  @@index([optionId])
  @@map("poll_vote")
}
```

Do `User` přibude `pollVotes PollVote[]`.

Kroky:

1. Upravit schéma.
2. `pnpm backend prisma:migrations:run` s názvem `quack_poll`.
3. **`pnpm backend prisma:generate`** (viz CLAUDE.md, jinak testy padnou na „Property poll does not exist“).
4. Zkontrolovat vygenerované SQL: unikát na `poll.quackId`, oba unikátní indexy na `poll_option`, složený FK z `poll_vote`, `ON DELETE CASCADE` na všech třech vazbách (smazání quacku odnese anketu, možnosti i hlasy).

Duplicitu textu možností v rámci ankety nevynucujeme indexem (porovnání je po `trim`, to DB index neudělá), hlídá ji validace při vytvoření.

## 3. Backend

Všechny soubory pod `apps/backend/src/modules/quack/`.

### 3.1 Doména (`domain/quack.ts`)

```ts
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 4;
export const POLL_OPTION_MAX_LENGTH = 50;

export type PollOption = {
  id: string;
  text: string;
  position: number;
  votes: number;
};
// `id` ankety zůstává v doméně (repository ho potřebuje pro upsert), ale do
// response DTO nejde – klient pracuje s id quacku.
export type Poll = {
  id: string;
  options: PollOption[];
  totalVotes: number;
  myOptionId: string | null;
};

export type Quack = {
  // ...stávající...
  poll: Poll | null; // null = obyčejný quack
};
```

Doménové chyby (vzor `UsernameTakenError` v profile): `QuackNotFoundError`, `QuackHasNoPollError`, `PollOptionNotFoundError`. Controller je překládá na 404 / 400.

### 3.2 Repository (`repositories/quack.repository.ts`)

- Sdílený include pro feed i detail:
  ```ts
  const withPoll = (viewerId: string) => ({
    user: true,
    poll: {
      include: {
        options: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
        votes: { where: { userId: viewerId }, select: { optionId: true } },
      },
    },
  });
  ```
- `getQuacks(filter, viewerId)`: `findMany` s `include: withPoll(viewerId)`. Mapovací funkce složí `Poll` (součet `_count`, `myOptionId` z jediného řádku `votes`), nebo `null` když `quack.poll` je `null`.
- `createQuack(data)`: přibude `pollOptions?: string[]`; zapsat přes nested `poll: { create: { options: { create: [...] } } }` s `position` = index pole. Jedna transakce zdarma (nested write).
- `findQuackById(id, viewerId)`: `findUnique` se stejným include, pro odpověď po hlasu.
- `upsertVote({ pollId, userId, optionId })`: `prisma.pollVote.upsert({ where: { pollId_userId: { pollId, userId } }, create, update: { optionId } })`. Na Postgresu Prisma přeloží jednoduchý upsert na `INSERT … ON CONFLICT DO UPDATE`, tedy atomicky. Porušení složeného FK (option z jiné ankety) přijde jako `P2003`; repository ho přeloží na `PollOptionNotFoundError`.

### 3.3 Service (`services/quacks.service.ts`)

- `getQuacks(filter, viewer)`: předá `viewer.id` do repository.
- `createQuack(user, { text, mood, pollOptions? })`: trim každé možnosti; když je zadaná anketa, ověřit počet 2–4, délku 1–50 a unikátnost (case-sensitive po trimu); při chybě vyhodit `InvalidPollError` → 400. (DTO hlídá tvar, service hlídá pravidlo, které DTO neumí: unikátnost po trimu.)
- `vote(user, quackId, optionId)`: napřed `findQuackById(quackId, user.id)`; když chybí → `QuackNotFoundError`, když `quack.poll === null` → `QuackHasNoPollError`. Pak `upsertVote({ pollId: quack.poll.id, userId: user.id, optionId })` a znovu `findQuackById` pro čerstvé počty. Tři dotazy, ale čitelné a pollId klient nikdy nevidí; výkon tu není téma.

### 3.4 Controller a DTO (`controllers/`)

- `dto/create-quack.dto.ts`: volitelné `poll?: CreatePollDto` s `options: string[]`, dekorátory `@ValidateNested`, `@Type(() => CreatePollDto)`, `@IsArray`, `@ArrayMinSize(2)`, `@ArrayMaxSize(4)`, `@IsString({ each: true })`, `@Length(1, 50, { each: true })`, `@Transform` na trim každé položky. Swagger `@ApiPropertyOptional` s příkladem `["Pizza", "Sushi", "Burger"]`.
- `dto/vote.dto.ts`: `{ optionId: string }` s `@IsString @IsNotEmpty`.
- `dto/quack.response.dto.ts`: `PollOptionDto`, `PollDto` (`options`, `totalVotes`, `myOptionId`; **bez** `id` ankety), `poll: PollDto | null` (s `nullable: true` v `@ApiProperty`).
- `quacks.controller.ts`:
  - `GET /quacks` – přidat `@User() user` a předat ho service.
  - `POST /quacks` – předat `body.poll?.options`.
  - **`PUT /quacks/:id/vote`** – `@HttpCode(200)`, tělo `VoteDto`, vrací `QuackResponseDto`. `@ApiResponse` 200 / 400 (neplatná možnost) / 401 / 404 (quack bez ankety nebo neexistuje). Guard `AuthenticatedUserGuard` už je na třídě, nový endpoint ho dědí (ověřit v testu nebo ručně přes curl bez cookie → 401).

### 3.5 Seed (`scripts/seed/seed/`)

- `create-quack.ts`: přidat volitelné `pollOptions: string[]`, vrátit vytvořený quack včetně `poll.options` (nested create), aby seed znal `pollId` i id možností pro hlasy.
- `seed-database.ts`: přidat quack od `caffeinatedDuck` „Where are we getting lunch?“ s možnostmi `Pond buffet / Bread stand / Skip lunch, more espresso`, plus hlasy od tří dalších seed uživatelů (dva na jednu možnost, jeden na druhou) zapsané přes `prisma.pollVote.create` s `pollId` + `optionId`, aby feed hned ukázal pruhy. Doplnit `"poll_vote", "poll_option", "poll"` do `TRUNCATE` (cascade by stačil, ale explicitní seznam je čitelnější).
- Testovací účty v seedu zůstávají (superadmin se neúčastní, ať je jeden účet bez hlasu pro ruční test scénáře 4).

### 3.6 Unit testy (`services/quacks.service.spec.ts`)

Mock repository (vzor existuje), nové případy:

- vytvoří quack s možnostmi (trimované, v zadaném pořadí) a bez ankety předá `pollOptions: undefined`;
- odmítne duplicitní možnosti po trimu (`"Pizza"`, `" pizza "` jsou různé; `"Pizza"`, `" Pizza "` stejné);
- `vote` dohledá quack, volá `upsertVote` s `pollId` z `quack.poll.id` (ne s id quacku) a vrátí quack z druhého `findQuackById`;
- `vote` na quack bez ankety vyhodí `QuackHasNoPollError` a `upsertVote` se nezavolá;
- `vote` na neexistující quack vyhodí `QuackNotFoundError`;
- `getQuacks` předává `viewer.id`.

Ověření: `pnpm backend test`, pak `curl -s http://localhost:4050/api/docs-json | grep -c vote` (musí být > 0) a kontrola, že `apps/backend/dist-dev/modules/quack/controllers/quacks.controller.js` je novější než editace. Pokud ne, restart `pnpm dev` (watcher umí minout přepsané soubory, viz CLAUDE.md).

## 4. Frontend

Všechny soubory pod `apps/frontend/src/features/quack/`, pokud není řečeno jinak.

### 4.1 Kit

`pnpm dlx shadcn@latest add progress` → `src/components/ui/progress.tsx`. Po vygenerování: zkontrolovat import `cn` z `@/lib/utils`, žádný nový balíček v `package.json`, odstranit případné `shadow-*`. Hlasovací možnosti jsou obyčejné `Button variant="outline"` z kitu, nic nového.

### 4.2 API vrstva

- `api/quackSchemas.ts`: `pollOptionSchema`, `pollSchema` (`options`, `totalVotes`, `myOptionId: z.string().nullable()`), `quackSchema` dostane `poll: pollSchema.nullable()`.
- `api/addQuack.ts`: `AddQuackInput` přibude `poll?: { options: string[] }`.
- `api/voteQuack.ts`: `voteQuack({ quackId, optionId })` → `api.put(\`quacks/${quackId}/vote\`, { json: { optionId } })`, parse přes `quackSchema`.
- `lib/poll.ts` (ve feature, ne v `src/lib`): `percentOf(votes, total)` – `total === 0 ? 0 : Math.round(votes / total * 100)`. Jedno místo pro zaokrouhlení, s testem.

### 4.3 Hooky

- `hooks/useVoteQuack.ts`: `useMutation({ mutationFn: voteQuack, onSuccess: (quack) => { queryClient.setQueriesData({ queryKey: quackKeys.lists() }, replaceById(quack)); void queryClient.invalidateQueries({ queryKey: quackKeys.lists() }) } })`. `setQueriesData` přepíše položku ve všech list variantách (plný feed i aktivní hledání), invalidace pak dotáhne případné cizí hlasy. Žádný `onMutate` (bez optimistic update).
- Chyba se nezobrazuje globálně; komponenta ji čte z `mutation.error` a ukáže inline.

### 4.4 Formulář (`components/QuackForm.tsx`)

- Do zod schématu: `poll: z.object({ options: z.array(z.string().trim().min(1, "Option can't be empty").max(50, "Keep it under 50 characters")).min(2).max(4) }).optional()` + `superRefine` na duplicity (po trimu) s chybou na konkrétním indexu.
- UI: ghost tlačítko „Add poll“ (ikona `ListChecks` z lucide) pod textareou. Po kliknutí se objeví blok s `useFieldArray` – 2 prázdné `Input`y s labely „Option 1“, „Option 2“, tlačítko „Add option“ (skryté při 4), u 3. a 4. možnosti ikonové „Remove“ (`aria-label`), tlačítko „Remove poll“ vrátí stav bez ankety. Žádná karta uvnitř formuláře, jen `space-y-3` a hairline `Separator` (DESIGN.md: žádné vnořené karty).
- Submit posílá `poll` jen když blok existuje; po úspěchu `form.reset` i zavření bloku.
- Textarea label je dál „New quack“; když je anketa otevřená, placeholder změnit na „Ask a question...“ (placeholder je příklad, ne label, to je v souladu s DESIGN.md).

### 4.5 Anketa ve feedu (`components/QuackPoll.tsx`, render z `QuackItem.tsx` pod textem)

Jedna komponenta, dva stavy podle `poll.myOptionId`:

- **Nehlasováno:** seznam `Button variant="outline" className="w-full justify-start"` s textem možnosti, `disabled={vote.isPending}`. Žádná čísla.
- **Hlasováno:** každá možnost jako `<button>` (dál klikatelný kvůli změně hlasu, `aria-pressed` u zvolené) s textem, procentem a `Progress value={percent}` pod ním; zvolená možnost `font-medium` + ikona `Check`; pod seznamem `text-sm text-muted-foreground`: „12 votes“ (`1 vote` singulár). Klik na už zvolenou možnost je no-op (nevolá mutaci).
- **Chyba:** `vote.isError` → `<p role="alert" className="text-sm text-destructive">Couldn't save your vote. Try again.</p>` pod možnostmi; stav zůstane ten z cache (nic se neměnilo), tlačítka jsou znovu aktivní. Chyba se vymaže při dalším pokusu (`vote.reset()` v `onClick` před `mutate`).
- Rozestupy `gap-2`, žádné stíny, žádná karta.

### 4.6 Testy (vitest)

- `components/QuackPoll.test.tsx`: před hlasem nejsou vidět počty; po `myOptionId` vidí procenta a celkový počet a zvolená má `aria-pressed`; klik volá mutaci s `{ quackId, optionId }` (mock `useVoteQuack`); při `isError` je vidět hláška a tlačítka nejsou `disabled`; při `isPending` jsou `disabled`.
- `lib/poll.test.ts`: `percentOf` pro 0 hlasů, zaokrouhlení.
- `QuackList.test.tsx`: existující fixture `quack()` dostane `poll: null`; přidat případ „quack s anketou vykreslí možnosti“.
- Rozšířit fixture i v ostatních testech, kde se `Quack` sestavuje ručně (grep `userId: "u1"`).

### 4.7 Ověření v prohlížeči (Claude in Chrome, `http://localhost:3050/`)

Přihlásit se seed účtem (`caffeinatedduck@example.com` / heslo ze seedu) a projít scénáře story v pořadí: 1 (vytvořit anketu), 3 (jedna možnost, duplicita, 51 znaků → hlášky pod poli), 2 (quack bez ankety), 4 (seed anketa bez hlasu u tohoto účtu → jen možnosti), 5 (hlas → pruhy, zvýraznění, „N votes“), 6 (změna → přesun, celkový počet stejný), 9 (odhlásit, přihlásit `breadcritic@example.com`, stejná čísla), 8 (v devtools nastavit offline, kliknout → inline chyba, tlačítka aktivní, online → opakování projde). Scénář 7 se ověří unit testem repository tvarem (`upsert`) a ručně: dvakrát rychle kliknout na dvě různé možnosti, výsledný `totalVotes` nenaroste o 2.

## 5. Pořadí práce a commity

Každý krok končí zeleným `pnpm check-all`. Semantic commity, jeden zájem na commit:

1. `feat(quack): add poll option and vote tables` – schéma, migrace, generate, seed s anketou a hlasy.
2. `feat(api): accept poll options when creating a quack` – doména, DTO, service validace, repository nested create, response DTO s `poll`, testy.
3. `feat(api): add vote endpoint for quack polls` – `PUT /quacks/:id/vote`, upsert, doménové chyby → 400/404, testy, Swagger.
4. `feat(web): add poll options to the quack form` – zod, field array, UI, test.
5. `feat(web): vote on polls in the feed` – schémata, `voteQuack`, hook, `QuackPoll`, Progress z kitu, testy.
6. Větev `quack-polls`, PR na `main` s odkazem na `.plans/quack-polls/user-story.md`.

Krok 4 lze dělat paralelně s krokem 3 (formulář potřebuje jen krok 2).

## 6. Rizika a otevřené body

- **Složený FK v Prisma** – `@relation(fields: [pollId, optionId], references: [pollId, id])` vyžaduje `@@unique([pollId, id])` na `PollOption`. Pokud by Prisma 7 s `prisma-client` generátorem složenou relaci nepřeložila, náhrada: ověřit `option.pollId === poll.id` v service před upsertem (ztrácíme garanci DB, zůstává aplikační kontrola). Ověřit hned v kroku 1.
- **1:1 vazba `Poll` ↔ `Quack`** – Prisma ji vyjádří přes `quackId @unique`; `quack.poll` je pak `Poll | null`. Pozor, aby `createQuack` bez ankety neposílal `poll: { create: ... }` s prázdnými možnostmi: `poll` musí v datech úplně chybět, jinak vznikne prázdná anketa, kterou DB nezakáže.
- **`GET /quacks` nově potřebuje viewera** – endpoint už je za guardem, takže `@User()` je vždy k dispozici; jen nezapomenout, že `getQuacks` mění signaturu a existující testy service se musí upravit.
- **Feed bez stránkování** – každý quack s anketou přidá join na `poll` a `_count` subselect na možnost. Při desítkách quacků v pořádku; při stovkách by bylo lepší agregovat přes `groupBy`. Neřešit teď, poznamenat do PR.
- **`UnsavedChangesGuard`** – pravidlo z paměti („každý formulář s rozepsanými změnami varuje před odchodem“) se na formulář quacku dnes neuplatňuje. Anketa formulář zvětšuje; **navrhuji guard přidat v kroku 4** (render z route `quacks.tsx`, `onDirtyChange` z `QuackForm`), ale je to rozšíření rozsahu story – potvrdit se zadavatelem před začátkem kroku 4.
- **Texty v UI jsou anglicky** jako zbytek aplikace („Add poll“, „Couldn't save your vote. Try again.“); story je česky, tester musí mapovat.
- **Měření zájmu** – dotaz pro vyhodnocení (mimo story, pro PO): `SELECT (SELECT count(*) FROM poll) AS polls, (SELECT count(*) FROM poll_vote) AS votes;`.
