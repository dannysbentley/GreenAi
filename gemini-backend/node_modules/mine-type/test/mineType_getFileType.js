var assert = require('assert')
var { getFileType } = require('..')
describe('getFileType(string)', function () {
  it('是否返回正确的数组', function () {
    var str = getFileType('text/html').toString()
    assert.strictEqual(str, ['body', 'htm', 'html'].toString())
  })
  it('是否返回正确的数组', function () {
    var str = getFileType('image/svg+xml').toString()
    assert.strictEqual(str, ['svg', 'svgz'].toString())
  })
  it('无效参数是否返回空数组', function () {
    var arr = getFileType('xxxxx')
    assert.strictEqual(Array.isArray(arr) && arr.length === 0, true)
  })
  it('空参数是否返回空数组', function () {
    var arr = getFileType('')
    assert.strictEqual(Array.isArray(arr) && arr.length === 0, true)
  })
  it('无参数是否返回空数组', function () {
    var arr = getFileType()
    assert.strictEqual(Array.isArray(arr) && arr.length === 0, true)
  })
  it('undefined参数是否返回空数组', function () {
    var arr = getFileType(undefined)
    assert.strictEqual(Array.isArray(arr) && arr.length === 0, true)
  })
  it('null参数是否返回空数组', function () {
    var arr = getFileType(null)
    assert.strictEqual(Array.isArray(arr) && arr.length === 0, true)
  })
  it('function参数是否返回空数组', function () {
    var arr = getFileType(() => { })
    assert.strictEqual(Array.isArray(arr) && arr.length === 0, true)
  })
  it('Object参数是否返回空数组', function () {
    var arr = getFileType({ })
    assert.strictEqual(Array.isArray(arr) && arr.length === 0, true)
  })
  it('Array参数是否返回空数组', function () {
    var arr = getFileType([])
    assert.strictEqual(Array.isArray(arr) && arr.length === 0, true)
  })
})
