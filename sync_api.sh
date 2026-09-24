#!/bin/zsh
# 通过 GitHub Git Data API 将本地工作区同步到远程 main（绕过 github.com 域名故障）
set -e
cd "$(dirname "$0")"
REPO="repos/shiy07986-hub/shiy07986-hub.github.io"
API="https://api.github.com"
TOKEN=$(git remote get-url origin | sed -E 's#.*:([^@]+)@.*#\1#')

api() {
  local method=$1 path=$2 data=$3
  if [ -n "$data" ]; then
    /usr/bin/curl -sS -X "$method" -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
      --data-binary "@$data" "$API/$path"
  else
    /usr/bin/curl -sS -X "$method" -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" "$API/$path"
  fi
}

# 1. 远程当前 main
remote_sha=$(api GET "$REPO/git/ref/heads/main" | jq -r .object.sha)
echo "远程 main: $remote_sha"

# 2. 为每个 git 跟踪文件创建 blob
TMP=$(mktemp -d)
entries_file="$TMP/entries.jsonl"
echo "[" > "$entries_file"
first=1
for f in $(git -c core.quotepath=off ls-files); do
  base64 -i "$f" -o "$TMP/b64"
  jq -n --rawfile c "$TMP/b64" '{content: $c, encoding: "base64"}' > "$TMP/payload.json"
  sha=$(api POST "$REPO/git/blobs" "$TMP/payload.json" | jq -r .sha)
  if [ "$sha" = "null" ] || [ -z "$sha" ]; then
    echo "上传失败: $f"; exit 1
  fi
  [[ $first -eq 0 ]] && echo "," >> "$entries_file"
  jq -n --arg p "$f" --arg s "$sha" '{path: $p, mode: "100644", type: "blob", sha: $s}' >> "$entries_file"
  first=0
  echo "已上传 blob: $f ($(du -h "$f" | cut -f1))"
done
echo "]" >> "$entries_file"
jq -s 'add' "$entries_file" > "$TMP/tree_payload.json"
jq -n --slurpfile t "$TMP/tree_payload.json" '{tree: $t[0]}' > "$TMP/tree_req.json"

# 3. 建树（不带 base_tree，完整替换远程内容）
tree_sha=$(api POST "$REPO/git/trees" "$TMP/tree_req.json" | jq -r .sha)
if [ "$tree_sha" = "null" ] || [ -z "$tree_sha" ]; then echo "建树失败"; exit 1; fi
echo "新树: $tree_sha"

# 4. 提交（父提交为远程 main，保证历史连续）
jq -n --arg t "$tree_sha" --arg p "$remote_sha" '{message: "同步本地照片墙（经 API）", tree: $t, parents: [$p]}' > "$TMP/commit_req.json"
commit_sha=$(api POST "$REPO/git/commits" "$TMP/commit_req.json" | jq -r .sha)
if [ "$commit_sha" = "null" ] || [ -z "$commit_sha" ]; then echo "创建提交失败"; exit 1; fi
echo "新提交: $commit_sha"

# 5. 更新 main 引用
result=$(jq -n --arg s "$commit_sha" '{sha: $s, force: true}' > "$TMP/ref_req.json"; api PATCH "$REPO/git/refs/heads/main" "$TMP/ref_req.json")
echo "$result" | jq -r '.object.sha // .message'

rm -rf "$TMP"
echo "同步完成"
