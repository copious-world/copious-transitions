dir=$1
echo $dir
pushd ./tools
node genpage.js ../sites/${dir}/static/${dir}.subst ../sites/${dir}/static/template/dashboard.html ../sites/${dir}/dashboard.html
popd
