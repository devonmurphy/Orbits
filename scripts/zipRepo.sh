rm -rf node_modules package-lock.json dist/ *.zip
git archive -o `git rev-parse HEAD`.zip @
