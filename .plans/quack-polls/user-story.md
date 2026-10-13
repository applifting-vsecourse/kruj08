## Anketa v quacku

### Základní formát

- **Jako** přihlášený člen Quackeru, který se potřebuje s ostatními rychle domluvit (třeba kam dnes na oběd),
- **chci** k quacku připojit 2 až 4 možnosti, ze kterých si každý zvolí právě jednu a kdykoli svou volbu změní,
- **abych** okamžitě a bez ručního počítání viděl, která možnost vede, a mohl se na výsledek spolehnout.

### Akceptační kritéria

**Scénář 1: Vytvoření quacku s anketou**

- **Pokud (Given):** jsem přihlášený a píšu nový quack,
- **Když (When):** vyplním text quacku (ten je otázkou ankety), přidám 2 až 4 možnosti, každou o délce 1 až 50 znaků, a quack odešlu,
- **Pak (Then):** quack se objeví ve feedu s textem, náladou (pokud jsem ji zvolil) a pod ním s klikatelnými možnostmi ankety. Nikde zatím nejsou žádné počty hlasů.

**Scénář 2: Quack bez ankety funguje jako dřív**

- **Pokud (Given):** jsem přihlášený, píšu nový quack a možnosti ankety nepřidám,
- **Když (When):** quack odešlu,
- **Pak (Then):** quack se uloží a zobrazí přesně tak jako dnes, bez jakéhokoli bloku ankety.

**Scénář 3: Neplatná anketa se neuloží**

- **Pokud (Given):** jsem přihlášený a v novém quacku mám jen jednu možnost, pátou možnost, prázdnou možnost, možnost delší než 50 znaků, nebo dvě stejné možnosti (shoda bez ohledu na mezery kolem),
- **Když (When):** zkusím quack odeslat,
- **Pak (Then):** quack se neuloží a u formuláře vidím srozumitelnou hlášku, co je špatně. Nic se ve feedu neobjeví.

**Scénář 4: Před hlasováním vidím jen možnosti**

- **Pokud (Given):** jsem přihlášený a ve feedu je cizí quack s anketou, ve které jsem ještě nehlasoval,
- **Když (When):** na něj narazím,
- **Pak (Then):** vidím klikatelné možnosti bez počtů hlasů a bez procent, i když ostatní už hlasovali.

**Scénář 4b: Autor vidí výsledky své ankety vždy**

- **Pokud (Given):** jsem přihlášený a ve feedu je moje vlastní anketa, ve které jsem nehlasoval,
- **Když (When):** na ni narazím,
- **Pak (Then):** vidím počty hlasů, procenta, pruhy i celkový počet hlasů, žádná možnost není zvýrazněná jako moje volba a dál mohu kliknutím hlasovat.

**Scénář 5: Hlasování**

- **Pokud (Given):** jsem přihlášený a ve feedu je anketa, ve které jsem ještě nehlasoval,
- **Když (When):** kliknu na jednu z možností,
- **Pak (Then):** možnosti se po dobu ukládání nedají znovu kliknout, stránka se nenačítá znovu, a jakmile je hlas uložen, u každé možnosti vidím počet hlasů, procento a pruh, pod anketou celkový počet hlasů a moje zvolená možnost je zvýrazněná. Autor ankety hlasuje stejně jako kdokoli jiný.

**Scénář 6: Změna hlasu**

- **Pokud (Given):** jsem přihlášený, v anketě jsem už hlasoval a vidím výsledky,
- **Když (When):** kliknu na jinou možnost,
- **Pak (Then):** můj hlas se přesune: původní možnost má o jeden hlas méně, nová o jeden víc, celkový počet hlasů se nemění a zvýrazněná je nová možnost. Kliknutí na možnost, kterou už mám zvolenou, nic nemění a hlas nelze úplně odvolat.

**Scénář 7: Jeden člověk, jeden hlas**

- **Pokud (Given):** jsem přihlášený a v anketě hlasuji opakovaně, velmi rychle za sebou nebo ze dvou otevřených oken,
- **Když (When):** se všechny tyto pokusy zpracují,
- **Pak (Then):** v anketě mám započítaný právě jeden hlas, a to pro naposledy zvolenou možnost. Celkový počet hlasů odpovídá počtu lidí, kteří hlasovali.

**Scénář 8: Hlas se nepodařilo uložit**

- **Pokud (Given):** jsem přihlášený, kliknu na možnost a hlas se nepodaří uložit (výpadek připojení, chyba serveru),
- **Když (When):** přijde chyba nebo odpověď nedorazí,
- **Pak (Then):** přímo pod anketou vidím hlášku „Hlas se nepodařilo uložit, zkuste to znovu“, anketa zůstává ve stavu před kliknutím (žádný hlas není zvýrazněný, resp. zůstává ten původní) a možnosti jsou znovu klikatelné.

**Scénář 9: Výsledky jsou pro všechny stejné**

- **Pokud (Given):** v anketě hlasovalo několik lidí,
- **Když (When):** si kdokoli z těch, kdo hlasovali, načte feed,
- **Pak (Then):** vidí stejné počty i procenta jako ostatní, odpovídající skutečně uloženým hlasům. Hlasy ostatních, které přibyly po mém načtení feedu, se mi ukážou až při dalším načtení; průběžné obnovování se nepožaduje.

### Odhad náročnosti

- **Story points:** 8 _(návrh pro tým)_
- **Proč:** Je to první strukturovaný obsah v quacku: nový typ dat, rozšíření formuláře i feedu a nová akce hlasování se stavem „ukládá se“ a chybovým stavem. Nejistá je hlavně spolehlivost pravidla „jeden hlas“ při souběžných požadavcích a to, jak se anketa vejde do stávající karty quacku bez porušení designového kontraktu.

### Developer note _(volitelné, jediné místo pro technické informace)_

- Nové Prisma modely navázané na `Quack`: anketa s možnostmi (pořadí, text) a hlas s unikátním klíčem `(userId, pollId)`; změna hlasu jako upsert, nikdy inkrement čítače. Po migraci nezapomenout na `pnpm backend prisma:generate`.
- `POST /api/quacks` rozšířit o volitelné pole `poll.options` (DTO: 2–4 položky, 1–50 znaků, trim + unikátnost); nový endpoint pro hlas, např. `PUT /api/quacks/:id/vote`, vrací aktuální stav ankety (počty, `myOptionId`, `canSeeResults`), aby klient čísla nikdy nepočítal sám ani nerozhodoval, komu je ukázat.
- Endpoint pro hlas chránit stejným `AuthenticatedUserGuard` jako ostatní quack endpointy; nepřihlášený požadavek dostane 401, hlas se nezapíše.
- `GET /api/quacks` musí vracet anketu včetně počtů a volby přihlášeného uživatele; počty agregovat na serveru. Souběh pokrýt unikátním indexem a ošetřením konfliktu.
- Frontend: rozšířit zod schéma a formulář v `src/features/quack`, mutace přes TanStack Query bez optimistic update (`isPending` zablokuje možnosti, `onError` zobrazí inline hlášku, `onSuccess` zapíše odpověď do cache seznamu). Pruhy/procenta řešit prvky z kitu (`pnpm dlx shadcn@latest add progress`), odstranit stíny podle DESIGN.md.
- Seed rozšířit o quack s anketou a pár hlasy; unit testy na validaci možností a na pravidlo jednoho hlasu.

**Předpoklady k ověření:**

- Limit 50 znaků na možnost a rozsah 2–4 možnosti potvrdil zadavatel v rozhovoru; ověřit ještě s designem, zda se čtyři možnosti vejdou do karty quacku na mobilu.
- Zájem o funkci se vyhodnotí ručně z databáze (počet anket a hlasů), žádný přehled v aplikaci se nestaví; potvrdit, kdo a kdy to vyhodnotí.
- Anketa se nikdy neuzavírá ani needituje; pokud by zadavatel chtěl uzavírání dřív, je to samostatná story.
