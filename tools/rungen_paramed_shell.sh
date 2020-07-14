dir=$1
template_source=$2
file=$3
odir=$4
ofile=$5
echo $dir
pushd ./tools
node prep_body_insert_only.js ../${dir}/static/template/${template_source}  ../${dir}/static/${file}  ../${dir}/static/tmp_output.html
node genpage.js ../${dir}/static/copious.subst ../${dir}/static/tmp_output.html ../${odir}/${ofile}
rm ../${dir}/static/tmp_output.html
popd
