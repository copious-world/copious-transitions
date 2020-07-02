dir=$1
echo $dir
pushd ./tools
node genpage.js ../${dir}/static/copious.subst ../${dir}/static/template/index.html ../${dir}/index.html
popd
