## Odpovědi pod quackem

### Základní formát

- **Jako** pravidelný uživatel Quackeru, který chce zareagovat na konkrétní quack a dnes musí psát nový příspěvek začínající „@jméno…“,
- **chci** odpovědět přímo pod tím quackem a vidět tam i odpovědi ostatních,
- **abych** já i ostatní na první pohled věděli, kdo na co reaguje, a moje odpověď zůstala vidět, i když autor původní quack později smaže.

### Akceptační kritéria

**Scénář 1: Odpověď na quack**

- **Pokud (Given):** jsem přihlášený a ve výpisu vidím cizí nebo vlastní quack,
- **Když (When):** zvolím „Odpovědět“, napíšu text, případně vyberu náladu, a odpověď odešlu,
- **Pak (Then):** odpověď se objeví pod quackem jako poslední, s mým jménem a náladou. Počet odpovědí se zvýší o jednu a vlákno zůstane rozbalené. Quack se ve výpisu neposune a moje odpověď se ve výpisu neobjeví jako samostatný příspěvek.

**Scénář 2: Sbalené vlákno ve výpisu**

- **Pokud (Given):** quack má tři odpovědi a jiný quack nemá žádnou,
- **Když (When):** procházím výpis,
- **Pak (Then):** pod prvním quackem vidím „3 odpovědi“ a volbu „Odpovědět“, pod druhým jen „Odpovědět“. Odpovědi uvidím až po rozbalení, seřazené od nejstarší.

**Scénář 3: Odpověď je jednodušší než quack**

- **Pokud (Given):** mám rozbalené vlákno,
- **Když (When):** píšu odpověď nebo se dívám na odpovědi ostatních,
- **Pak (Then):** k odpovědi nejde přidat anketu, jen text a náladu. U jednotlivých odpovědí není volba „Odpovědět“, takže odpovídá se vždy jen na původní quack.

**Scénář 4: Autor smaže quack, na který už někdo odpověděl**

- **Pokud (Given):** pod quackem od @jana jsou dvě odpovědi od jiných lidí,
- **Když (When):** Jana svůj quack smaže, nebo ho smaže admin,
- **Pak (Then):** všichni, včetně Jany, místo quacku uvidí „Smazaný quack od @jana“. Text, nálada ani anketa se neukážou a obsah nejde zjistit ani mimo běžné rozhraní aplikace. Obě odpovědi zůstanou pod ním beze změny i se jmény svých autorů. Volba „Odpovědět“ u něj už není. Řádek vypadá stejně, ať quack smazala Jana, nebo admin.

**Scénář 5: Smazaný quack bez odpovědí zmizí jako dnes**

- **Pokud (Given):** quack nemá žádnou odpověď, nebo byly všechny jeho odpovědi smazány,
- **Když (When):** je quack smazaný,
- **Pak (Then):** z výpisu, hledání i záložky „Moje“ zmizí úplně, bez zástupného řádku.

**Scénář 6: Smazání odpovědi**

- **Pokud (Given):** jsem autor odpovědi, nebo admin,
- **Když (When):** odpověď smažu (admin s povinným důvodem, stejně jako u quacku),
- **Pak (Then):** odpověď zmizí všem beze stopy a počet odpovědí se sníží. Byla-li to poslední odpověď pod smazaným quackem, zmizí i jeho zástupný řádek. Běžný uživatel u cizí odpovědi volbu „Smazat“ nevidí.

**Scénář 7: Quack mezitím zmizel**

- **Pokud (Given):** mám rozepsanou odpověď pod quackem, který mezitím autor nebo admin smazal,
- **Když (When):** odpověď odešlu,
- **Pak (Then):** odpověď se neuloží a uvidím hlášku, že quack byl mezitím smazán. Můj text zůstane ve formuláři, abych si ho mohl zkopírovat. Ve vlákně se objeví zástupný řádek a formulář pro odpověď zmizí.

**Scénář 8: Neplatná nebo neodeslaná odpověď**

- **Pokud (Given):** mám otevřený formulář odpovědi,
- **Když (When):** odešlu prázdný text, text delší než u quacku, nebo je aplikace nedostupná,
- **Pak (Then):** odpověď se neuloží, uvidím srozumitelnou hlášku a napsaný text i nálada ve formuláři zůstanou.

**Scénář 9: Rozepsaná odpověď nezmizí bez varování**

- **Pokud (Given):** mám rozepsanou odpověď,
- **Když (When):** vlákno sbalím, nebo přejdu na jinou stránku,
- **Pak (Then):** aplikace se zeptá, jestli rozepsanou odpověď opravdu zahodit. Teprve po potvrzení se text ztratí.

**Scénář 10: Hledání najde i odpovědi**

- **Pokud (Given):** odpověď od @petr obsahuje slovo „rybník“ a quack, pod kterým je, ho neobsahuje,
- **Když (When):** hledám „rybník“ nebo „petr“,
- **Pak (Then):** ve výsledcích vidím ten quack s rozbaleným vláknem, ve kterém je odpověď vidět. Je-li quack smazaný, ve výsledcích je jeho zástupný řádek s vláknem. Text smazaného quacku ani smazané odpovědi hledání nikdy nenajde.

**Scénář 11: „Moje“ ukazuje i diskuse, do kterých jsem psal**

- **Pokud (Given):** odpověděl jsem pod cizím quackem,
- **Když (When):** otevřu záložku „Moje“,
- **Pak (Then):** kromě mých quacků v ní vidím i ten cizí quack s rozbaleným vláknem a se svou odpovědí. Pokud svou odpověď smažu, quack ze záložky zmizí.

### Odhad náročnosti

- **Story points:** 13 _(návrh pro tým)_
- **Proč:** Mazání, nálada i moderace už existují a odpovědi je převezmou. Nová je ale celá diskuse pod quackem, zástupný řádek, který obrací dnešní pravidlo „smazaný quack se nikde neukazuje“ a přitom nesmí prozradit obsah, a úpravy hledání i záložky „Moje“. Nejvíc nejistoty je v tom, aby hledání a zástupný řádek nikde neprozradily smazaný text.

### Developer note

- **Model (rozhodnuto):** satelit `QuackReply` podle vzoru `Poll`. Odpověď je běžný řádek `Quack` plus `QuackReply(quackId @id → Quack onDelete Cascade, parentId → Quack, createdAt)` s `@@index([parentId, createdAt])`. Na `Quack` vzniknou dvě pojmenované relace (`reply QuackReply?`, `replies QuackReply[]`). Odpovědi tím zdarma převezmou soft delete, `QuackDeletion`, mazání moderátorem i `mood`. Migrace, pak `pnpm backend prisma:generate`.
- **Smazání účtu (rozhodnuto: blokovat):** FK `parentId` nesmí kaskádovat. Pozor, Postgres `RESTRICT` se vyhodnotí hned, ještě před kaskádou (stejná past, jakou popisuje komentář u `QuackDeletion.deletedBy`), takže by zablokoval i uživatele, který odpověděl pod vlastním quackem. Použít `onDelete: NoAction` (kontrola na konci příkazu): smazání účtu tak selže jen tehdy, když pod jeho quackem zůstane cizí odpověď. Ověřit v `*.db-spec.ts` oba případy. Zástupný řádek bez jména přijde až s procedurou mazání účtu (mimo rozsah).
- **Invarianty (rozhodnuto: aplikace):** `CreateReplyDto` má jen `text` (stejné `@MaxLength(280)` jako `CreateQuackDto`) a `mood`. Anketa tedy nejde poslat a hlasování na odpovědi skončí na existujícím `QuackHasNoPollError`. Hloubku 1 a „rodič není smazaný“ hlídat přímo v zápisu, ne kontrolou před ním: v transakci `INSERT` odpovědi podmíněný `parent.deletedAt IS NULL AND NOT EXISTS (quack_reply WHERE quackId = parent)`, stejný princip jako `softDelete`. Nic nezapsáno → přečíst a rozlišit 404 (rodič neexistuje), 409/410 (smazán, frontend → scénář 7) a 422 (rodič je odpověď).
- **Zápis (rozhodnuto):** `POST /api/quacks/:id/replies`, autor ze session. Mazání odpovědi jde přes stávající `DELETE /api/quacks/:id` beze změny a `canDelete` v `QuackResponseDto.fromDomain` platí i pro odpovědi.
- **Čtení (rozhodnuto):** feed vrací u každého vrcholového quacku `replyCount` (jen živé odpovědi, filtrovaný `_count`). Vlákno se načítá přes `GET /api/quacks/:id/replies` (živé odpovědi, od nejstarší) a vrací 404, když rodič není ani živý, ani tombstone. Na frontendu vlastní query key pod `quackKeys`. Po odpovědi nebo smazání invalidovat vlákno i feed (počet, tombstone).
- **Tombstone (rozhodnuto: v repozitáři):** `getQuacks` vyřadí odpovědi (bez řádku `QuackReply`) a zahrne smazané vrcholové quacky, které mají aspoň jednu živou odpověď. Mapování je vrátí jako doménový typ s `deleted: true` a `text`/`mood`/`poll` = `null` (nenačítat je vůbec, ne až v DTO). `user` zůstane kvůli „Smazaný quack od @jméno“. `notDeleted` tím dostane jedinou řízenou výjimku. Doplnit `quack.repository.spec.ts`, které u každé nové metody kontroluje i smazaný quack, a ESLint pravidlo `no-restricted-syntax` nechat platit.
- **Hledání:** `searchWhere` rozšířit o shodu v živé odpovědi (text, `name`, `username` jejího autora) a vrátit rodiče s příznakem pro rozbalení vlákna (např. `expandReplies`). Shoda na vlastním textu se smí hledat jen u živého quacku. Tombstone se do výsledků dostane jen přes shodu v odpovědi, jinak hledání prozradí smazaný obsah.
- **„Moje“:** filtr `authorId` = můj vrcholový quack **nebo** quack s mou živou odpovědí, se stejným příznakem pro rozbalení. Index feedu `[deletedAt, createdAt desc]` pak doplní anti-join na `quack_reply`. Zkontrolovat plán dotazu na seedu.
- **Frontend:** před UI přečíst `DESIGN.md` (vlákno je odsazený seznam, ne vnořené karty). Sbalování přes `pnpm dlx shadcn@latest add collapsible`, pokud v kitu chybí. Odstranit shadow a zkontrolovat import `cn`. Formulář odpovědi převezme text a náladu z `QuackForm` bez ankety. Rozepsaná odpověď se musí dostat k `UnsavedChangesGuard` v `routes/_ProtectedPages/quacks.tsx` a sbalení vlákna potřebuje vlastní dotaz.
- **Seed a ověření:** do seedu přidat vlákno s odpověďmi i tombstone (smazaný rodič s živou odpovědí). Ověřit v prohlížeči na `FRONTEND_URL` včetně prázdného vlákna, smazaného rodiče a chyby při odeslání. Rozšířit e2e z `test(web): cover admin deletion end to end`.

### Předpoklady k ověření

- Délka odpovědi je stejná jako u quacku, 1–280 znaků; nálada je volitelná _(návrh, ověřit s PO)_.
- Autor smí odpovědět i pod vlastním quackem _(návrh, ověřit s PO)_.
- Přesná znění („Odpovědět“, „3 odpovědi“, „Smazaný quack od @jméno“, hláška o mezitím smazaném quacku) jsou návrh. Aplikace je dnes anglicky, takže finální texty dodá PO.
- Účet, pod jehož quackem je cizí odpověď, dočasně nepůjde smazat. Zástupný řádek „Smazaný quack“ bez jména přijde s procedurou mazání účtu.
- **Mimo rozsah:** upozornění autora na novou odpověď, posun vlákna nahoru po nové odpovědi, úprava odpovědi, odpověď na odpověď, mazání účtu z aplikace.

### Návrh rozdělení

Pokud tým 13 bodů neodsouhlasí, story jde přirozeně rozdělit:

1. **Odpovědi pod quackem a jejich mazání** (scénáře 1–9): jádro, které řeší „kdo na co reaguje“.
2. **Odpovědi ve hledání a v záložce „Moje“** (scénáře 10–11): navazuje na první a samostatně jde předvést i otestovat.
