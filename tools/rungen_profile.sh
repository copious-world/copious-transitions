dir=$1
echo $dir
pushd ./tools
node genpage.js ../sites/${dir}/static/${dir}.subst ../sites/${dir}/static/template/profile.html ../sites/${dir}/profile.html
popd
