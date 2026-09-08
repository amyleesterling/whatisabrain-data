# whatisabrain-data

The open data behind [whatisabrain.com/mouse](https://whatisabrain.com/mouse/), and the viewer that reads it.

`mouse/data/` holds 32,036 single neurons from five collections, every axon traced across a whole mouse brain and registered to the Allen Mouse Brain Common Coordinate Framework (CCFv3, 2017), plus the MERFISH cell positions, the named projection subtypes, the target-region tables, and the two connectome packs (the MICrONS cubic millimetre and the CA3 volume of Zheng et al.) with their real synapse positions. `mouse/` is a copy of the page itself, so this repository also serves the viewer at [amyleesterling.github.io/whatisabrain-data/mouse/](https://amyleesterling.github.io/whatisabrain-data/mouse/).

| Source | Neurons | Licence |
|---|---|---|
| MouseLight, Janelia Research Campus (Winnubst et al., Cell 2019) | 1,651 | CC BY-NC 4.0 |
| SEU-ALLEN, Brain Image Library (Peng et al., Nature 2021) | 1,741 | CC BY-SA 4.0 |
| ION prefrontal projectome, Digital Brain (Gao et al., Nat Neurosci 2022) | 6,357 | research and education, attribution, non-commercial |
| ION hippocampus projectome, Digital Brain (Qiu et al., Science 2024) | 10,023 | research and education, attribution, non-commercial |
| ION whole-cortex projectome, Digital Brain (Gao et al., Neuron 2026) | 12,264 new (18,621 total, 6,357 shared with the prefrontal set) | research and education, attribution, non-commercial |

Every file's provenance, citation and licence is in [mouse/NOTICE.txt](mouse/NOTICE.txt). The data is derived from those datasets and carries their licences: no part of it may be used commercially without the permission of its owner. Nothing here is invented: every position is a measured position and every synapse is one from the reconstruction's own table.

## Layout

- `mouse/data/neurons.json` – one record per neuron (id, source, soma, region, targets, lengths, shard and byte offset) and the region name table
- `mouse/data/neurons-<k>.bin` – packed polylines, read by byte range: Uint32 path count, Uint32 vertex count, per-path Uint16 counts, Int16 xyz at 10 µm about the frame centre, Uint16 distance from the soma, Uint8 compartment
- `mouse/data/axons-coarse-<source>.bin` – every axon of one source at 100 µm, for the all-axons view
- `mouse/data/cells.bin`, `cells.json` – MERFISH cell positions and classes
- `mouse/data/regions.json`, `subtype-names.json`, `hipp-subtypes*.json`, `featured.json`, `frame.json` – region table, named subtypes, the featured neurons, the frame definition
- `mouse/data/microns/`, `mouse/data/ca3/` – the connectome packs: `cube.json` and the per-cell synapse files (Int16 xyz plus a Uint8 flag)
- `mouse/js/`, `mouse/index.html`, `mouse/zh/`, `mouse/neuron/` – the viewer (three.js vendored under `mouse/vendor/`)

The frame is millimetres about the centre of the CCF root mesh's bounding box; `mouse/data/frame.json` gives the offset back to CCF micrometres.

## Building it

The build lives with the site: `tools/build-mouse.py` reads the raw downloads (MouseLight NeuronBrowser JSON, SEU-ALLEN `_reg.swc`, Digital Brain SWC, the Allen MERFISH release) and writes this folder. The raw inputs are tens of gigabytes and are not in this repository.

## Licence

See [LICENSE.md](LICENSE.md): the viewer code is published source, copyright Amy Sterling, and the data files carry the licences of their sources, listed in `mouse/NOTICE.txt`.
