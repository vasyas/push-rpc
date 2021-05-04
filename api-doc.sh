#!/bin/bash
typedoc --out api-docs/$1 --tsconfig ./packages/$1/tsconfig.json --readme none packages/$1/src/index.ts
