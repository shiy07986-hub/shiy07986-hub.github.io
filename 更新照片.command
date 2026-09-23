#!/bin/zsh
# 扫描 photos 文件夹，重新生成照片清单 photos.js，并推送到 GitHub Pages
cd "$(dirname "$0")"

{
  print -n "window.WALL_PHOTOS = ["
  first=1
  for f in photos/*(.N); do
    case "${f:l}" in
      *.jpg|*.jpeg|*.png|*.gif|*.webp|*.bmp) ;;
      *) continue ;;
    esac
    [[ $first -eq 0 ]] && print -n ", "
    print -n "\"$f\""
    first=0
  done
  print "];"
} > photos.js

count=0
for f in photos/*(.N); do
  case "${f:l}" in
    *.jpg|*.jpeg|*.png|*.gif|*.webp|*.bmp) count=$((count+1)) ;;
  esac
done
echo "照片清单已更新，共 ${count} 张照片。"

# 若当前目录是 git 仓库，则自动提交并推送（线上约 1 分钟后生效）
if [ -d .git ]; then
  git add photos photos.js
  if git diff --cached --quiet; then
    echo "没有需要推送的变更。"
  else
    git commit -m "更新照片墙（${count} 张）" >/dev/null
    if git push origin main >/dev/null 2>&1; then
      echo "已推送到 GitHub，约 1 分钟后线上生效。"
    else
      echo "推送失败，请检查网络后手动执行：git push origin main"
    fi
  fi
else
  echo "提示：当前目录不是 git 仓库，仅更新了本地清单。"
fi
