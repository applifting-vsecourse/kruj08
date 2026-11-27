## Lajky u quacků

### Základní formát

- **Jako** čtenář feedu, který narazí na quack, se kterým souhlasí nebo který ho pobavil, ale nemá k němu co napsat,
- **chci** quack jedním kliknutím lajknout a u každého quacku vidět, kolik lidí ho lajklo,
- **abych** autorovi dal najevo, že se mi líbí, aniž bych psal odpověď typu „+1“, a sám na první pohled poznal, které quacky ostatní oceňují.

### Akceptační kritéria

**Scénář 1: Lajknutí quacku**

- **Pokud (Given):** jsem přihlášený a ve feedu vidím quack, který jsem ještě nelajkl, s počtem lajků 3,
- **Když (When):** kliknu na tlačítko lajku u toho quacku,
- **Pak (Then):** tlačítko se změní na „lajknuto“ a počet ukáže 4. Po obnovení stránky i v jiném prohlížeči stav i počet zůstanou stejné.

**Scénář 2: Vzetí lajku zpět**

- **Pokud (Given):** quack, který jsem dřív lajkl, má počet lajků 4,
- **Když (When):** kliknu znovu na tlačítko lajku,
- **Pak (Then):** tlačítko se vrátí do stavu „nelajknuto“ a počet ukáže 3. Quack můžu později lajknout znovu.

**Scénář 3: Každý lajkne jen jednou**

- **Pokud (Given):** quack jsem už lajkl,
- **Když (When):** ho lajknu znovu, třeba dvojklikem, z druhé záložky nebo ze dvou zařízení najednou,
- **Pak (Then):** počítám se mezi lajky pořád jen jednou. Stejně tak opakované vzetí lajku zpět počet nesníží pod skutečný stav: nelajknutý quack zůstane nelajknutý.

**Scénář 4: Počet vidí všichni stejně**

- **Pokud (Given):** quack lajkli dva různí lidé, ale já ne,
- **Když (When):** se dívám do feedu, do výsledků hledání nebo do záložky „Moje“,
- **Pak (Then):** u quacku vidím počet 2 a tlačítko ve stavu „nelajknuto“. Quack, který zatím nikdo nelajkl, ukazuje počet 0. Lajky ostatních se mi nezobrazují jako moje.

**Scénář 5: Lajky u odpovědí a u vlastních quacků**

- **Pokud (Given):** mám rozbalené vlákno s odpověďmi, nebo se dívám na svůj vlastní quack,
- **Když (When):** kliknu na lajk u odpovědi nebo u svého quacku,
- **Pak (Then):** lajk se započítá stejně jako u kteréhokoli jiného quacku.

**Scénář 6: Smazaný quack nejde lajknout**

- **Pokud (Given):** quack mezitím smazal autor nebo admin, nebo ve feedu zůstal jen jako „Smazaný quack od @jméno“,
- **Když (When):** se ho pokusím lajknout nebo lajk vzít zpět,
- **Pak (Then):** nic se neuloží a uvidím hlášku, že quack už neexistuje. U zástupného řádku smazaného quacku tlačítko lajku ani počet vůbec nejsou.

**Scénář 7: Nepřihlášený návštěvník a výpadek**

- **Pokud (Given):** nejsem přihlášený, nebo je aplikace zrovna nedostupná,
- **Když (When):** se pokusím quack lajknout nebo lajk vzít zpět,
- **Pak (Then):** lajk se neuloží. Nepřihlášený návštěvník se k lajkování vůbec nedostane, stejně jako dnes k feedu. Přihlášený uživatel při výpadku uvidí srozumitelnou hlášku a tlačítko i počet se vrátí do stavu před kliknutím.

### Odhad náročnosti

- **Story points:** 5 _(návrh pro tým)_
- **Proč:** Lajk je podobný hlasování v anketě, které aplikace už umí: jeden člověk, jedna věc, počet spočítaný z uložených záznamů. Nové je vzetí lajku zpět, okamžitá odezva tlačítka bez čekání na server i s návratem při chybě, a to, že počet se musí objevit všude, kde se quack zobrazuje.

### Developer note

- Způsob uložení a počítání rozhoduje ADR `docs/adr/002-likes.md`.
- Odpověď je obyčejný řádek `quack` (ADR 001), takže lajk odpovědi je lajk quacku a nepotřebuje vlastní model ani endpoint.
- Lajknutí i vzetí zpět mají být idempotentní (opakovaný požadavek nemění výsledek). Proto `PUT` / `DELETE /api/quacks/:id/like`, ne přepínač `POST /toggle`, který by se při dvojkliku nebo opakování požadavku sám zrušil.
- `QuackResponseDto` dostane `likeCount` a `likedByMe`, obojí počítané na serveru pro přihlášeného uživatele (vzor `poll.myOptionId`). U tombstonu `likeCount = 0`, `likedByMe = false` a frontend tlačítko neukazuje.
- Smazaný quack (`deletedAt`) nesmí lajk přijmout ani odebrat: kontrolovat přes `notDeleted` v repozitáři, odpověď 404.
- Frontend: optimistický update v TanStack Query s rollbackem v `onError`, tlačítko z `src/components/ui/` (podle `DESIGN.md`), `aria-pressed` pro stav lajknuto.

### Předpoklady k ověření

- Lajkovat smí i autor vlastní quack a lajkovat jde i odpovědi _(návrh, ověřit s PO)_.
- Počet 0 se ukazuje, místo aby se schoval _(návrh, ověřit s PO)_.
- Kdo konkrétně lajkl, se nikde nezobrazuje, jen počet. Upozornění autora na nový lajk je **mimo rozsah**.
- Aplikace je dnes anglicky; popisky tlačítka („Like“ / „Unlike“) dodá PO.
