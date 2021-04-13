dir=$1
target=$2
echo $dir
bash ./tools/rungen.sh $dir
bash ./tools/rungen_header_shell.sh $dir
bash ./tools/rungen_dashboard.sh  $dir
bash ./tools/rungen_profile.sh  $dir
bash ./tools/rungen_paramed_shell.sh $dir header-empty.html fauth_logged_in_closer.html 'local' fauth_logged_in_closer.html
bash ./tools/rungen_paramed_shell.sh $dir header-empty.html fauth_fail_closer.html 'local' fauth_fail_closer.html
bash ./tools/rungen_paramed_shell.sh $dir header-empty.html fauth_success_closer.html 'local' fauth_success_closer.html
if [ ! -z "$target" ]; then
    echo "next --------------------------- "
    pwd
    echo $target
    if [ -d "$target" ]; then
        if [ ! -d "$target/html" ]; then
            mkdir ${target}/html
        fi
        if [ ! -d "$target/html/${dir}" ]; then
            mkdir ${target}/html/${dir}
        fi
        cp sites/${dir}/*.html ${target}/html/${dir}/
    fi
fi
