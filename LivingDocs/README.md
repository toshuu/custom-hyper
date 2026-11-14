# LivingDocs (ss-living-doc)

An **ss-living-doc** is a step list for a weak coding model. A strong model writes it. A weak model follows it.

One ss-living-doc implements one skeleton, or one part of one skeleton.

Name each file `SSLD-NNN-short-name.md`. Use `SSLD-001` first.

Copy `.stageset/templates/ss-living-doc.md`. Read `.stageset/ss-living-doc-format.md` first.

```bash
python scripts/ss-living-doc.py LivingDocs/SSLD-001-short-name.md
python scripts/ss-living-doc.py LivingDocs/SSLD-001-short-name.md --next
python scripts/ss-living-doc.py LivingDocs/SSLD-001-short-name.md --sync
```

Do not put run evidence reports here. Evidence reports stay in `.stageset/runs/`.
