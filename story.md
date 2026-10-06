## Hledání příspěvků ve feedu

### Základní formát

- **Jako** pravidelný čtenář feedu, který se chce vrátit k příspěvku z minulého týdne a pamatuje si z něj jedno slovo nebo jméno autora
- **chci** napsat to slovo nebo jméno do pole nad feedem a vidět jen příspěvky, které se s ním shodují
- **abych** příspěvek našel během pár sekund místo několikaminutového scrollování, které dnes často vzdávám

### Akceptační kritéria

**Scénář 1: Hledání podle slova z textu**

- **Pokud (Given):** jsem přihlášený, dívám se na feed a ve feedu existuje příspěvek obsahující slovo „kachna“
- **Když (When):** napíšu do pole nad feedem „kachna“
- **Pak (Then):** feed zobrazí jen příspěvky, jejichž text obsahuje „kachna“, bez ohledu na velikost písmen a bez ohledu na to, kolik příspěvků bylo napsáno od té doby

**Scénář 2: Hledání podle autora**

- **Pokud (Given):** jsem přihlášený a ve feedu jsou příspěvky od autora „Jana Nováková“ s uživatelským jménem „jana“
- **Když (When):** napíšu do pole „nová“ nebo „jana“
- **Pak (Then):** feed zobrazí všechny příspěvky od Jany Novákové spolu s případnými příspěvky, které hledaný výraz obsahují v textu

**Scénář 3: Nic se nenašlo**

- **Pokud (Given):** jsem přihlášený a mám v poli vyplněný výraz, který se neshoduje s žádným příspěvkem ani autorem
- **Když (When):** výsledky se načtou
- **Pak (Then):** místo prázdného místa vidím srozumitelnou zprávu, že hledání nic nenašlo, a pole zůstává vyplněné, abych mohl výraz upravit

**Scénář 4: Zrušení hledání**

- **Pokud (Given):** mám v poli vyplněný výraz a vidím zúžený feed
- **Když (When):** pole vymažu
- **Pak (Then):** feed se vrátí k běžnému zobrazení všech příspěvků od nejnovějšího, přesně jako před hledáním

**Scénář 5: Hledání během psaní**

- **Pokud (Given):** píšu do pole delší výraz po jednotlivých písmenech
- **Když (When):** se na chvíli zastavím
- **Pak (Then):** feed se aktualizuje podle toho, co je v poli právě teď, mezitím je zřejmé, že se výsledky načítají, a nikdy se nezobrazí výsledky pro starší, už přepsaný výraz

**Scénář 6: Nový příspěvek při aktivním hledání**

- **Pokud (Given):** mám v poli vyplněný výraz a vidím zúžený feed
- **Když (When):** odešlu nový příspěvek
- **Pak (Then):** příspěvek se uloží a ve zúženém feedu se objeví jen tehdy, pokud hledanému výrazu odpovídá; po vymazání pole je vidět vždy

### Odhad náročnosti

- **Story points:** 5 _(návrh pro tým)_
- **Proč:** Feed dnes nemá žádný způsob, jak si říct o část příspěvků, takže hledání je první takový parametr a zavádí vzor, na který pak naváže stránkování. Pracné je hlavně chování při psaní (zpoždění, načítání, zahazování zastaralých výsledků) a shoda jak na textu, tak na jménu i uživatelském jménu autora.

### Developer note _(volitelné, jediné místo pro technické informace)_

- `GET /api/quacks` dostane nepovinný query parametr pro hledaný výraz, validovaný v DTO stejně jako `CreateQuackDto` (whitelist je zapnutý, nevalidovaný parametr by spadl). Bez parametru se chování nemění.
- V `QuackRepository.getQuacks` přibude `where` s `OR` přes `text`, `user.name` a `user.username`, všechno `contains` s `mode: 'insensitive'` (ILIKE). Řazení `createdAt desc` zůstává. `where` se později bez změny zkombinuje s `take` a `cursor` pro stránkování.
- Není to fulltext: žádný tsvector, GIN index ani relevance. Pokud se objeví výkonový problém na velkém objemu, řešit zvlášť (pg_trgm), ne v této story.
- Frontend: hledaný výraz patří do query key (`quackKeys.lists()` dostane parametr), aby TanStack Query držel výsledky per výraz a zahodil staré. Debounce na vstupu, `placeholderData` nebo `keepPreviousData` kvůli blikání seznamu. Invalidace po `addQuack` musí zasáhnout všechny varianty listu (prefix klíče).
- Pole hledání vzít ze shadcn kitu (`Input` už existuje), bez stínu dle `DESIGN.md`.
- Testy: service/repository test na parametr, frontend test na prázdný stav a návrat k plnému seznamu po vymazání.

**Předpoklady k ověření:**

- Minimální délka výrazu pro odeslání dotazu: _návrh 1 znak, ověřit s klientem_. Kratší hranice znamená víc dotazů, delší znamená, že krátká jména nejdou hledat.
- Zpoždění po posledním stisku klávesy před odesláním: _návrh cca 300 ms, ověřit s týmem_.
- Hledaný výraz se nezapisuje do adresy stránky, takže hledání nejde sdílet odkazem ani obnovit po reloadu. _Návrh pro první verzi, ověřit s klientem._
- Měření, zda lidé hledání používají, není součástí této story. Pokud ho klient chce mít od prvního dne, je to samostatná story (událost analytiky při odeslání hledání).
