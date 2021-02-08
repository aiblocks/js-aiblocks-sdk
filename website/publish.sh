#!/bin/bash

set -e

cd ../../js-aiblocks-lib-gh-pages
git checkout -- .
git clean -dfx
git fetch
git rebase
rm -Rf *
cd ../js-aiblocks-lib/website
npm run-script docs
cp -R docs/* ../../js-aiblocks-lib-gh-pages/
rm -Rf docs/
cd ../../js-aiblocks-lib-gh-pages
git add --all
git commit -m "update website"
git push
cd ../js-aiblocks-lib/website