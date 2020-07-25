dir=$1
echo $dir
pushd ./tools
node genpage.js ../sites/${dir}/static/${dir}.subst ../sites/${dir}/static/template/index.html ../sites/${dir}/index.html
popd
