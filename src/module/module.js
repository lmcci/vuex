import { forEachValue } from '../util'

// raw 原始的 未经加工的
export default class Module {
  // rawModule 就是new Vuex.Store(options) 传入的options
  constructor (rawModule, runtime) {
    // 当前模块是否是动态添加的
    this.runtime = runtime
    this._children = Object.create(null)
    this._rawModule = rawModule
    // 原始的state
    const rawState = rawModule.state
    // 判断state是否是个函数 是函数就调用一次 把返回值当做state
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
  }

  // 当前module是否设置了命名空间
  get namespaced () {
    return !!this._rawModule.namespaced
  }

  // 添加子module
  // 往_children对象中添加
  addChild (key, module) {
    this._children[key] = module
  }

  // 删除子module
  removeChild (key) {
    // delete 删除_children对象中某个属性
    delete this._children[key]
  }

  // 获取某个子module
  getChild (key) {
    // 直接从_children对象中取
    return this._children[key]
  }

  // 更新 重新赋值 没有state
  update (rawModule) {
    this._rawModule.namespaced = rawModule.namespaced
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }

  // 遍历_children 把所有的键值对当成参数 调用fn
  forEachChild (fn) {
    forEachValue(this._children, fn)
  }

  forEachGetter (fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn)
    }
  }

  forEachAction (fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn)
    }
  }

  forEachMutation (fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
