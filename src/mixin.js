export default function (Vue) {
  // Vue的版本判断
  const version = Number(Vue.version.split('.')[0])

  // 对于2.x 和 1.x走不同的逻辑  还没出3.x
  if (version >= 2) {
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // override init and inject vuex init procedure
    // for 1.x backwards compatibility.
    const _init = Vue.prototype._init
    Vue.prototype._init = function (options = {}) {
      options.init = options.init
        ? [vuexInit].concat(options.init)
        : vuexInit
      _init.call(this, options)
    }
  }

  /**
   * Vuex init hook, injected into each instances init hooks list.
   */

  // 这个方法已经mixin到全局的beforeCreate中 所以this代表的是vm
  // 给每个vm添加一个$store
  // $store指向的是同一个对象 new Vue() 的时候传入的 store: new Vuex.Store(opt)实例
  function vuexInit () {
    const options = this.$options
    // store injection
    // 根vm才会有store
    if (options.store) {
      // 判断传入的是个方法就调用一次
      // 不是方法就直接赋值
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } else if (options.parent && options.parent.$store) {
      // 非根vm
      // beforeCreate先父后子
      // 所以parent.$store 也是能够指向根vm的store
      this.$store = options.parent.$store
    }
  }
}
