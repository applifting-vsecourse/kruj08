# 001: Odpověď je obyčejný quack se satelitem `QuackReply`

- **Stav:** přijato
- **Datum:** 2026-11-13
- **Souvisí s:** [`.plans/quack-replies/user-story.md`](../../.plans/quack-replies/user-story.md)

## Kontext

Lidé chtějí odpovídat přímo pod quackem. Odpovědi patří lidem, kteří je napsali: když autor smaže quack, na který už někdo odpověděl, odpovědi s ním nesmí zmizet. Odpověď je přitom co do obsahu skoro quack: má text se stejným limitem, volitelnou náladu, autora a čas, maže ji autor (bez důvodu) nebo admin (s důvodem) a hledání v ní má hledat stejně jako v quacku. Na rozdíl od quacku nemá anketu a nedá se na ni dál odpovědět (vlákno má jednu úroveň).

Mazání quacku je soft delete (`Quack.deletedAt` + záznam v `QuackDeletion`). Na tom stojí moderace, a to včetně atomické kontroly oprávnění přímo v zápisu a záznamu o tom, kdo a proč mazal.

## Rozhodnutí

Odpověď je **řádek v tabulce `quack`**, který má navíc **satelit `QuackReply`** (1:1, primární klíč `quackId`) s odkazem `parentId` na quack, na který odpovídá. Vrcholový quack satelit nemá; „je to odpověď“ je existence řádku, ne nullable sloupec.

```
quack ──1:1── quack_reply(quackId PK, parentId FK)
  ▲                                       │
  └───────────── rodič (N:1) ─────────────┘
```

- `quack_reply.quackId → quack.id`, `onDelete: Cascade`: satelit žije a umírá se svým řádkem.
- `quack_reply.parentId → quack.id`, bez kaskády (`onDelete: NoAction`) a v databázi `DEFERRABLE INITIALLY DEFERRED`: databáze nedovolí fyzicky smazat quack, pod kterým zůstala cizí odpověď (dnes to nastane jen kaskádou při smazání účtu). Kontrola probíhá až při commitu. Kaskáda `user → quack` totiž běží jako vnořený příkaz a okamžitá kontrola (`RESTRICT` i nedeferovaný `NO ACTION`) by se spustila dřív, než kaskáda odstraní satelity vlastních odpovědí. Zablokovala by tak i účet, jehož jediné odpovědi jsou pod jeho vlastními quacky. Prisma deferrable neumí vyjádřit, proto je v samostatné SQL migraci.
- Pravidla „odpověď nemá anketu“ a „nejde odpovědět na odpověď“ hlídá aplikace. DTO odpovědi pole ankety nemá a zápis odpovědi je jediný `INSERT … SELECT`, který rodiče ověří ve stejném příkazu, takže mezi kontrolou a zápisem nic nevklouzne.

## Zvažované varianty

1. **Sloupec `Quack.parentId`.** Nejméně kódu a stejná recyklace mazání i hledání. Hlavní tabulka by ale dostala nullable sloupec a „je odpověď“ by se odvozovalo z null. Satelit stojí jeden join navíc a dává budoucím atributům odpovědi (např. „odpověď na konkrétní odpověď“, citace) vlastní místo, stejně jako `Poll`.
2. **Samostatná tabulka `Reply`.** Hloubku 1 a „bez ankety“ by vynutil už tvar dat, jenže by duplikovala soft delete, `QuackDeletion`, mazání moderátorem s důvodem, náladu i hledání napříč dvěma tabulkami. Každé budoucí pravidlo o mazání nebo moderaci by se psalo dvakrát.

## Důsledky

- Odpovědi zdarma převezmou soft delete, záznam v `QuackDeletion`, mazání moderátorem, náladu i endpoint `DELETE /api/quacks/:id`.
- Každé čtení feedu musí odpovědi vyřadit (`reply: null`). Vlákno se čte zvlášť přes `GET /api/quacks/:id/replies`.
- Pravidlo „smazaný quack neexistuje“ (`notDeleted`) dostává jednu řízenou výjimku: smazaný vrcholový quack se živými odpověďmi se vrací jako **tombstone**. Repozitář z něj sestaví zástupný objekt, který pole pro text, náladu ani anketu vůbec nemá, takže obsah nikdy neopustí repozitář. Hledání smazaný quack nenajde podle jeho vlastního textu, jen přes živou odpověď.
- Účet, pod jehož quackem zůstala cizí odpověď, nejde smazat, dokud nevznikne procedura mazání účtu. Ta pak rozhodne, jak tombstone bez autora vypadá.
- Pravidla „bez ankety“ a „hloubka 1“ databáze nevynucuje. Kód, který by zapisoval do `quack_reply` nebo `poll` mimo `QuackRepository`, je může porušit. Totéž platí pro migraci, která by FK rodiče znovu vytvořila bez `DEFERRABLE`. Kdyby to začalo vadit, jde je doplnit triggerem bez změny tvaru dat.
