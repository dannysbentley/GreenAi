var assert = require('assert')
var { getContentType } = require('..')
describe('getContentType(string, string)', function () {
  it('是否返回正确的Content-Type', function () {
    var str = getContentType('html')
    assert.strictEqual(str, 'text/html')
  })
  it('是否返回正确的Content-Type', function () {
    var str = getContentType('svg')
    assert.strictEqual(str, 'image/svg+xml')
  })
  it('找不到是否返回为空', function () {
    var str = getContentType('xxsvg')
    assert.strictEqual(str, '')
  })
  it('找不到是否返回指定的Content-Type', function () {
    var str = getContentType('xxsvg', 'text/html')
    assert.strictEqual(str, 'text/html')
  })
  it('无参数是否是否处理', function () {
    var str = getContentType()
    assert.strictEqual(str, '')
  })
  it('undefined参数是否是否处理', function () {
    var str = getContentType(undefined, 'text/html')
    assert.strictEqual(str, '')
  })
  it('null参数是否是否处理', function () {
    var str = getContentType(null, 'text/html')
    assert.strictEqual(str, '')
  })
  it('undefined参数是否是否处理', function () {
    var str = getContentType('html2', undefined)
    assert.strictEqual(str, '')
  })
  it('null参数是否是否处理', function () {
    var str = getContentType('html2', null)
    assert.strictEqual(str, '')
  })
  it('function参数是否是否处理', function () {
    var str = getContentType(() => { })
    assert.strictEqual(str, '')
  })
  it('Object参数是否是否处理', function () {
    var str = getContentType({ })
    assert.strictEqual(str, '')
  })
  it('Array参数是否是否处理', function () {
    var str = getContentType([])
    assert.strictEqual(str, '')
  })
})
