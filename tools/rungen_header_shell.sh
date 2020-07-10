dir=$1
echo $dir
pushd ./tools
node genpage.js ../${dir}/static/copious.subst ../${dir}/static/template/header-empty.html ../personals-templates/header-empty.html
popd
