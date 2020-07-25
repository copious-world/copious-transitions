dir=$1
template_source=$2
file=$3
odir=$4
ofile=$5
echo $dir
pushd ./tools
node prep_body_insert_only.js ../sites/${dir}/static/template/${template_source}  ../sites/${dir}/static/${file}  ../sites/${dir}/tmp_output.html
#
node genpage.js ../sites/${dir}/static/${dir}.subst ../sites/${dir}/tmp_output.html ../sites/${dir}/${odir}/${ofile}
rm ../sites/${dir}/tmp_output.html
popd
