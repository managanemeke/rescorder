# rescorder

## install

### dependencies

```shell
bun install
```

## run

```shell
bun run index.ts 
```

```shell
bun run index.ts "file:///C:/Users/wi/Documents/apollohome/storage/1mi25-1.apollo.zip_dir/index.html?display=32&channel=212" 10000
```

```shell
campaign="vkmax25" \
  && display=104 \
  && content=27152 \
  && duration=5000 \
  && rate=25 \
  && name="${campaign}_${display}_${content}" \
  && link="https://light.maergroup.ru/storage/samples/$campaign/?display=$display&content=$content" \
  && bun run index.ts $link $name $duration $rate
```

### csv

```shell
bun csv.ts "input/vkmax25.csv"
```
