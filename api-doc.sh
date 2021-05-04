#!/bin/bash
typedoc --out api-docs/$1 --entryDocument index.md --tsconfig ./packages/$1/tsconfig.json --readme none --theme ./node_modules/typedoc-github-wiki-theme/dist packages/$1/src/index.ts
