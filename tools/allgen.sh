dir=$1
echo $dir
bash ./tools/rungen.sh $dir
bash ./tools/rungen_header_shell.sh $dir
bash ./tools/rungen_paramed_shell.sh $dir header-empty.html fauth_logged_in_closer.html 'local' fauth_logged_in_closer.html
bash ./tools/rungen_paramed_shell.sh $dir header-empty.html fauth_fail_closer.html 'local' fauth_fail_closer.html
bash ./tools/rungen_paramed_shell.sh $dir header-empty.html fauth_success_closer.html 'local' fauth_success_closer.html
