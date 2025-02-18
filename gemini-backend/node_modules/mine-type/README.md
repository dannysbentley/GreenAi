# mine-type
Nodejs服务端，根据请求地址中的文件后缀获取 Content-Type 

## Installation

```sh
$ npm install mine-type
```

## API

```js
var mineType = require('mine-type')
```

#### mineType.getContentType(string) 
根据文件后缀名返回对应 Content-Type

```js
var htmlType = mineType.getContentType('html')
var pngType = mineType.getContentType('png')
// htmlType = "text/html"
// pngType = "image/png"
```


####  mineType.getFileType(string)
根据Content-Type(不能包含其他参数,比如 "; charset=uft-8")返回文件类型。
返回的数据类型是数组，可能返回多个后缀名，如果没找到则返回空数组

```js
var htmlSuffix = mineType.getFileType('text/html')
var pngSuffix = mineType.getFileType('image/png')
// htmlSuffix = [ 'body', 'htm', 'html' ]
// pngSuffix = [ 'png' ]
```


## License

[MIT](LICENSE)