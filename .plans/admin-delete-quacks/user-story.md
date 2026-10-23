## Admin smaže nevhodný příspěvek kohokoli

### Základní formát

- **Jako** admin Quackeru, který ve výpisu narazí na šarlatánský příspěvek, jehož autor ho odmítá smazat,
- **chci** takový příspěvek smazat sám, ať je kohokoli, a napsat k tomu důvod,
- **abych** nemusel čekat na autora, ostatní lidé na ten příspěvek už nenarazili a já mohl později doložit, proč jsem zasáhl.

### Akceptační kritéria

**Scénář 1: Admin může smazat jakýkoli příspěvek**

- **Pokud (Given):** jsem přihlášený jako admin,
- **Když (When):** procházím výpis příspěvků (obě záložky) nebo výsledky hledání,
- **Pak (Then):** u každého příspěvku, i u cizích a u příspěvků jiných adminů, vidím volbu „Smazat“.

**Scénář 2: Smazání cizího příspěvku s důvodem**

- **Pokud (Given):** jsem přihlášený jako admin a u cizího příspěvku jsem zvolil „Smazat“,
- **Když (When):** v potvrzovacím okně, které ukazuje jméno autora, upozorňuje, že smazání nejde vrátit, a kolik hlasů z ankety zmizí s ním, napíšu důvod a smazání potvrdím,
- **Pak (Then):** příspěvek zmizí všem, včetně autora, z výpisu, hledání i hlasování, a to i s anketou a hlasy; uvidím krátké potvrzení „Příspěvek smazán“; uloží se, kdo ho smazal, kdy a s jakým důvodem. Autor žádnou zprávu nedostane.

**Scénář 3: Bez důvodu smazat nejde**

- **Pokud (Given):** jsem přihlášený jako admin a mám otevřené potvrzovací okno u jakéhokoli příspěvku, i u svého vlastního,
- **Když (When):** zkusím smazání potvrdit s prázdným důvodem nebo jen s mezerami,
- **Pak (Then):** příspěvek se nesmaže, okno zůstane otevřené a u pole se objeví „Napište důvod smazání“.

**Scénář 4: Běžný uživatel dál maže jen svoje**

- **Pokud (Given):** jsem přihlášený jako běžný uživatel,
- **Když (When):** dívám se na cizí příspěvek,
- **Pak (Then):** volbu „Smazat“ u něj nevidím a ani pokus mimo běžné rozhraní aplikace příspěvek nesmaže; svůj vlastní příspěvek mažu dál jako dnes, bez důvodu.

**Scénář 5: Příspěvek mezitím zmizel**

- **Pokud (Given):** jako admin mám rozepsaný důvod u příspěvku, který mezitím smazal autor nebo jiný admin,
- **Když (When):** smazání potvrdím,
- **Pak (Then):** uvidím potvrzení, že příspěvek je pryč, ne chybu; uložený zůstane záznam toho, kdo ho smazal jako první.

**Scénář 6: Smazání se nepovede**

- **Pokud (Given):** jako admin mám vyplněný důvod a aplikace je nedostupná,
- **Když (When):** smazání potvrdím,
- **Pak (Then):** okno zůstane otevřené se srozumitelnou hláškou, napsaný důvod v něm zůstane a příspěvek je dál vidět všem.

**Scénář 7: Rozepsaný důvod nezmizí bez varování**

- **Pokud (Given):** jako admin mám v potvrzovacím okně rozepsaný důvod,
- **Když (When):** okno zavřu (Zrušit, Esc, klik mimo) nebo přejdu na jinou stránku,
- **Pak (Then):** aplikace se zeptá, jestli rozepsaný důvod opravdu zahodit; teprve po potvrzení se okno zavře a příspěvek zůstane nesmazaný.

### Odhad náročnosti

- **Story points:** 5 _(návrh pro tým)_
- **Proč:** Navazuje na hotové mazání autorem (potvrzovací okno i zmizení všude už fungují); nové je oprávnění pro admina, povinný důvod s ochranou proti ztrátě rozepsaného textu a uložení záznamu o smazání. Navíc se obrací dřívější pravidlo „admin nemá výjimku“, takže se přepisují i existující testy.

### Developer note

- Obrací záměrné rozhodnutí: komentáře u `QuacksService.deleteQuack` a `QuackNotOwnedError` v `domain/quack.ts`, test `refuses an admin too: the role is no bypass` v `quacks.service.spec.ts` a Swagger popisy v `quacks.controller.ts` a `quack.response.dto.ts` — přepsat, ne jen obejít.
- `canDelete` v `QuackResponseDto.fromDomain` = autor **nebo** role `admin`; frontend (`QuackItem` → `QuackActions`) se pak ukáže sám. Aktualizovat komentář v `quackSchemas.ts`.
- Dnes `softDeleteOwnQuack` hlídá vlastnictví přímo v zápisu (`updateMany` s `userId`). Admin potřebuje variantu bez `userId` a zápis `deletedAt` + záznamu atomicky; při souběhu (scénář 5) zůstane záznam toho, kdo smazal první, a 404 frontend dál bere jako úspěch.
- Kdo/kdy/důvod jsou nová data → migrace. Podle „Model new entities for the next feature“ v CLAUDE.md zvážit samostatnou entitu místo sloupců na `Quack` (přehled smazaných bude pravděpodobně další story). `deletedAt` na `Quack` nechat jako jediný zdroj pro `notDeleted` a index feedu. Po migraci `prisma:generate`.
- Důvod musí dorazit s požadavkem: těla u `DELETE` jsou v HTTP sporná, rozhodnout mezi `DELETE` s tělem a `POST /api/quacks/:id/deletion`; validace v DTO (trim, min/max délka).
- Role se čte z `Identity.role`; `admin` už v `UserRole` je, žádná migrace role. Přidělení ručně: `UPDATE "user" SET role = 'admin' WHERE email = …`. BetterAuth má `input: false`, takže si roli nikdo nenastaví při registraci.
- Frontend: do alert-dialogu v `QuackActions.tsx` přibude `textarea` (už v kitu, bez shadow); stav „rozepsáno“ musí dosáhnout na `UnsavedChangesGuard` (route-level přes `useBlocker`) v `routes/_ProtectedPages/quacks.tsx` a zavření dialogu potřebuje vlastní dotaz.
- Ověření v prohlížeči: přihlásit se jako `superadmin` ze seedu (`SUPERADMIN_EMAIL`); seed má cizí příspěvky i anketu s hlasy.

### Předpoklady (odsouhlaseno s PO)

- **Délka důvodu:** aspoň 1 znak, který není mezera, nejvýš 500 znaků.
- **„Smaže cokoli“** zahrnuje i příspěvky jiných adminů.
- **Záznam „kdo a kdy“** se ukládá u každého smazání, i autorem (ten bez důvodu), aby budoucí přehled byl jednotný.
- Důvod zatím nikdo v aplikaci nevidí, ani autor; dohledá ho jen vývojář.
- **Mimo rozsah** („nic víc prozatím“): zablokování autora, obnovení smazaného příspěvku, upozornění autora, přehled smazaných, obrazovka pro přidělování role admin.
