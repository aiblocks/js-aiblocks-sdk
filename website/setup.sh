#!/bin/bash

cd ../../
if [ "$TRAVIS" ]; then
  git clone "https://aiblocks-jenkins@github.com/aiblocks/js-aiblocks-lib.git" js-aiblocks-lib-gh-pages
else
  git clone git@github.com:aiblocks/js-aiblocks-lib.git js-aiblocks-lib-gh-pages
fi
cd js-aiblocks-lib-gh-pages
git checkout origin/gh-pages
git checkout -b gh-pages
git branch --set-upstream-to=origin/gh-pages
cd ../js-aiblocks-lib/website
