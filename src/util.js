/**
 * Get the first item that pass the test
 * by second argument function
 *
 * @param {Array} list
 * @param {Function} f
 * @return {*}
 */
// 过滤数组 返回第一个元素
// f是过滤条件 一个函数
function find (list, f) {
  return list.filter(f)[0]
}

/**
 * Deep copy the given object considering circular structure.
 * This function caches all nested objects and its copies.
 * If it detects circular structure, use cached copy to avoid infinite loop.
 *
 * @param {*} obj
 * @param {Array<Object>} cache
 * @return {*}
 */
// 神拷贝
export function deepCopy (obj, cache = []) {
  // just return if obj is immutable value
  // null 或者 不是一个对象就直接返回
  // 没有必要再遍历
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // if obj is hit, it is in circular structure
  // 是否命中缓存  从缓存中过滤记录original的要拷贝的原始对象是否相等
  const hit = find(cache, c => c.original === obj)
  // 命中缓存了 就直接返回上次缓存好的拷贝对象（万一上次别人改了怎么办）
  if (hit) {
    return hit.copy
  }

  // 要遍历的是数组还是对象 创建一个空值
  const copy = Array.isArray(obj) ? [] : {}
  // put the copy into cache at first
  // because we want to refer it in recursive deepCopy
  // 先添加进缓存中 方便下次直接取
  cache.push({
    original: obj,
    copy
  })

  // 遍历每个键值  对所有的递归执行深拷贝
  Object.keys(obj).forEach(key => {
    copy[key] = deepCopy(obj[key], cache)
  })

  return copy
}

/**
 * forEach for object
 */
// 遍历一个对象 把所有的键值对当成参数 调用fn
export function forEachValue (obj, fn) {
  Object.keys(obj).forEach(key => fn(obj[key], key))
}

// 判断是否是一个object类型的对象
export function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}

// 判断是否是promise对象
export function isPromise (val) {
  return val && typeof val.then === 'function'
}

// 断言  如果条件不成立 就抛出数组
export function assert (condition, msg) {
  if (!condition) throw new Error(`[vuex] ${msg}`)
}
