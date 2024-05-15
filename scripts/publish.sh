#!/usr/bin/env bash

npm run build 
rm -rf dist/core/templates
cp -rf src/core/templates dist/core/templates
npm publish ./ --access public
