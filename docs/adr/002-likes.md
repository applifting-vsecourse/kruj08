# 002: Lajk je řádek v `quack_like` se složeným primárním klíčem, počet se počítá dotazem

- **Stav:** přijato
- **Datum:** 2026-11-27
- **Souvisí s:** [`.plans/quack-likes/user-story.md`](../../.plans/quack-likes/user-story.md), [ADR 001](001-reply-is-a-quack.md)

## Kontext

Lidé chtějí u quacku dát najevo, že se jim líbí, a vidět, kolik lidí ho lajklo. Každý smí quack lajknout nejvýš jednou a lajk zase vzít zpět. Pravidlo „jednou“ musí platit i při dvojkliku, ze dvou záložek nebo ze dvou zařízení najednou, tedy pro souběžné požadavky. Odpověď je podle ADR 001 obyčejný řádek `quack`, takže lajk odpovědi je lajk quacku.

Každá odpověď feedu nese u quacku dvě hodnoty: kolik má lajků (stejné číslo pro všechny) a jestli ho lajkl ten, kdo se dívá. Smazání quacku je soft delete (`Quack.deletedAt`), řádek tedy zůstává a kaskády se nespustí. Smazaný quack nesmí lajk přijmout ani odebrat. Zástupný řádek smazaného quacku (ADR 001) žádné lajky neukazuje.

Ankety už mají stejný tvar problému: `poll_vote` s primárním klíčem `(pollId, userId)` a počty spočítanými z řádků přes `_count`.

## Rozhodnutí

Lajk je **řádek v nové tabulce `quack_like`** s **primárním klíčem `(quackId, userId)`**. Počet lajků **se nikde neukládá**: při čtení se spočítá z řádků (Prisma `_count`, filtrovaný stejně jako `replyCount`). Totéž platí pro „lajkl jsem“: jde o existenci řádku pro přihlášeného uživatele (vzor `poll.votes where userId`).

```
quack ──1:N── quack_like(quackId, userId) ──N:1── user
              PK (quackId, userId)
              INDEX (userId)
```

- `quack_like.quackId → quack.id`, `onDelete: Cascade`: když quack zmizí fyzicky (dnes jen kaskádou při smazání účtu), jeho lajky zmizí s ním. Soft delete lajky nechá v tabulce, jen je nikdo neuvidí.
- `quack_like.userId → user.id`, `onDelete: Cascade`: smazaný účet si lajky nebere s sebou do statistik. Index na `userId` zrychlí kaskádu a později i „quacky, které se mi líbily“.
- `createdAt` na řádku: kdy lajk vznikl. Stojí jeden sloupec a dává smysl pro budoucí řazení nebo upozornění, aniž by se měnil tvar dat.
- **Lajknutí** je jeden příkaz `INSERT … SELECT … FROM quack WHERE id = $1 AND "deletedAt" IS NULL ON CONFLICT DO NOTHING`. Ten najednou ověří, že quack žije, a díky primárnímu klíči nepřipustí druhý řádek, ať přijde souběžně cokoli. Když nic nezapíše, krátké čtení rozliší „už lajknuto“ (úspěch, idempotentní) od „quack neexistuje nebo je smazaný“ (404).
- **Vzetí zpět** je `DELETE` řádku `(quackId, userId)`, podmíněný tím, že quack žije. Mazání chybějícího řádku je úspěch (idempotentní), smazaný nebo neexistující quack je 404.
- **HTTP:** `PUT /api/quacks/:id/like` a `DELETE /api/quacks/:id/like`. Obě operace vracejí aktualizovaný quack, stejně jako `PUT /:id/vote`, aby klient dostal počet, který vidí i ostatní. Přepínač (`POST /toggle`) se zamítá: opakovaný nebo zdvojený požadavek by lajk sám vrátil.
- **Odpověď API:** `QuackResponseDto` dostane `likeCount: number` a `likedByMe: boolean`. Zástupný řádek smazaného quacku má `0` / `false` a lajky se pro něj vůbec nenačítají.

## Zvažované varianty

1. **Tabulka `quack_like` s unikátním klíčem, počet dotazem (zvoleno).**
   - _Výhody:_ „jednou na člověka“ vynucuje databáze, takže to žádný souběžný požadavek nerozbije a žádný test služby to nemusí znovu dokazovat. Počet nikdy nemůže nesouhlasit se skutečností, protože se nikde neukládá. Víme, kdo lajkl, takže „lajkl jsem“ i budoucí „kdo to lajkl“ jsou jen dotazy. Stejný vzor jako `poll_vote`, takže v repu není nový koncept.
   - _Nevýhody:_ každé čtení feedu počítá `COUNT` na každý quack (korelovaný poddotaz, který pokryje index primárního klíče). Při dnešní velikosti feedu (bez stránkování, desítky quacků) je to zanedbatelné.
   - _Co by se později měnilo špatně:_ prakticky nic. Když se počítání jednou stane úzkým hrdlem, jde doplnit počítadlo (varianta 3) bez ztráty dat, protože se dá kdykoli dopočítat z řádků.

2. **Jen počítadlo `Quack.likeCount`.**
   - _Výhody:_ nejlevnější čtení, jeden sloupec, žádný join.
   - _Nevýhody:_ neví, kdo lajkl, takže nejde poznat, jestli už lajknuto, ani zabránit druhému lajku nebo odebrat lajk, který tam nebyl. Pravidlo „jednou na člověka“ by nešlo vynutit vůbec. Každé zdvojené kliknutí počet trvale posune.
   - _Co by se později měnilo špatně:_ všechno. Z čísla nejde zpětně zjistit, kdo lajkl, takže přechod na tabulku by začínal od nuly nebo s počty, které se už nikdy nesrovnají. **Zamítnuto, protože nesplní akceptační kritéria.**

3. **Tabulka `quack_like` + denormalizované počítadlo `Quack.likeCount`.**
   - _Výhody:_ pravidlo „jednou“ vynucuje tabulka a čtení feedu nepotřebuje `COUNT`.
   - _Nevýhody:_ dvě místa pravdy. Počítadlo se musí měnit ve stejné transakci jako řádek, nebo triggerem, a jakýkoli zápis mimo tuto cestu (seed, ruční SQL, kaskáda při smazání účtu, která počítadlo sama nesníží) ho rozjede. Souběžné lajky téhož quacku se navíc řadí za zámek jeho řádku. Každý zápis lajku by také měnil `quack.updatedAt`, pokud by se to výslovně neobcházelo.
   - _Co by se později měnilo špatně:_ jednou rozjeté počítadlo se musí přepočítat migrací a není jasné, kdy přesně se rozjelo. **Zamítnuto jako předčasná optimalizace.** Je to přirozený další krok, až změřené čtení feedu ukáže, že `COUNT` vadí. Varianta 1 do něj vede bez migrace dat.

## Důsledky

- Nová tabulka a migrace, potom `pnpm backend prisma:generate`. `resetDatabase` v integračních testech ji vyprázdní sám, protože maže všechny tabulky.
- Každé čtení quacku v `QuackRepository`, které vrací `Quack` (feed, vlákno, `findQuackById`, vytvoření quacku i odpovědi), počítá lajky a lajk přihlášeného uživatele. Doménový typ `Quack` dostane `likeCount` a `likedByMe`, `DeletedQuack` ne.
- Lajkovat jde i vlastní quack a odpovědi. Kdyby PO chtěl jinak, je to pravidlo ve službě, ne změna tvaru dat.
- Lajky soft-smazaného quacku zůstanou v tabulce. Kdyby se smazaný quack někdy obnovoval, vrátí se i s lajky. Fyzicky je odstraní jen kaskáda.
- Pořadí feedu se lajky nemění. Řazení podle oblíbenosti by počítadlo (varianta 3) spíš potřebovalo a je mimo rozsah.
