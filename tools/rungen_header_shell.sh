dir=$1
echo $dir
pushd ./tools
node genpage.js ../sites/${dir}/static/${dir}.subst ../sites/${dir}/static/template/header-empty.html ../sites/${dir}/header-empty.html
popd
