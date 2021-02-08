git clone -b gh-pages "https://aiblocks-jenkins@github.com/aiblocks/js-aiblocks-sdk.git" jsdoc

if [ ! -d "jsdoc" ]; then
  echo "Error cloning"
  exit 1
fi

git clone https://github.com/aiblocks/js-aiblocks-base
npm run docs
cd jsdoc
git add .
git commit -m $TRAVIS_TAG
git push origin gh-pages
