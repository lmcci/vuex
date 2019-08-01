import applyMixin from './mixin'
import devtoolPlugin from './plugins/devtool'
import ModuleCollection from './module/module-collection'
import { forEachValue, isObject, isPromise, assert } from './util'

let Vue // bind on install

// store类 外面可以通过new创建
export class Store {
  constructor (options = {}) {
    // Auto install if it is not done yet and `window` has `Vue`.
    // To allow users to avoid auto-installation in some cases,
    // this code should be placed here. See #731
    // 可以直接script引入？ 是否已经install过了 没有就install一遍
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue)
    }

    if (process.env.NODE_ENV !== 'production') {
      // 能否拿到Vue 如果没有就报错
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      // 是否支持promise 没有就报错
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      // this是否是Store实例 不是就报错  必须通过new的方式来使用
      assert(this instanceof Store, `Store must be called with the new operator.`)
    }

    // new Vuex.Store(options) 传入的选项
    // 可以有插件 是使用严格模式
    const {
      plugins = [],
      strict = false
    } = options

    // 传入的state
    let {
      state = {}
    } = options

    // 如果传入的state是一个函数 就调用一下
    if (typeof state === 'function') {
      state = state() || {}
    }

    // store internal state
    // 定义一些空对象
    this._committing = false
    this._actions = Object.create(null)
    this._actionSubscribers = []
    this._mutations = Object.create(null)
    this._wrappedGetters = Object.create(null)
    // 设置的所有子modules格式化
    // 生成一个树状结构的module对象_modules.root为根  _modules._children为所有的子module
    this._modules = new ModuleCollection(options)
    this._modulesNamespaceMap = Object.create(null)
    this._subscribers = []
    this._watcherVM = new Vue()

    // bind commit and dispatch to self
    // 当前new出来的实例
    const store = this
    // 对dispatch commit 做一层封装，改变上下文
    // 在dispatch, commit 使用this就是store实例
    const { dispatch, commit } = this
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    this.strict = strict

    // init root module.
    // this also recursively registers all sub-modules
    // and collects all module getters inside this._wrappedGetters
    // 把module格式化
    installModule(this, state, [], this._modules.root)

    // initialize the store vm, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    // 生成响应式对象
    resetStoreVM(this, state)

    // apply plugins
    // 遍历所有的插件 然后调用一次  传入的参数是store实例
    plugins.forEach(plugin => plugin(this))

    // 是否使用了devtools 可以把初始化state 改变state传给devtools  devtools的改变也可以改变store
    if (Vue.config.devtools) {
      devtoolPlugin(this)
    }
  }

  // 获取store.state的时候 其实是在访问this._vm._data.$$state
  get state () {
    return this._vm._data.$$state
  }

  // 直接给store.state赋值的时候 报错
  set state (v) {
    if (process.env.NODE_ENV !== 'production') {
      assert(false, `Use store.replaceState() to explicit replace store state.`)
    }
  }

  // 实例的commit方法
  commit (_type, _payload, _options) {
    // check object-style commit
    // 统一参数
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    const entry = this._mutations[type]
    // commit的type不存在
    // mutation中没有 就直接输出错误
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    // 调用传入的 函数
    this._withCommit(() => {
      // 遍历mutation 执行里面所有的方法
      entry.forEach(function commitIterator (handler) {
        handler(payload)
      })
    })
    // 有监听的时候 调用所有的 把mutation  state当做参数传入
    this._subscribers.forEach(sub => sub(mutation, this.state))

    if (
      process.env.NODE_ENV !== 'production' &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  // store实例的dispatch方法
  dispatch (_type, _payload) {
    // check object-style dispatch
    // 统一参数
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    const entry = this._actions[type]
    // action中没有对应的type 就报错
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    // 监听 取出来全部调用一次
    this._actionSubscribers.forEach(sub => sub(action, this.state))

    return entry.length > 1
      // 有多个 就组成promise等待所有的都resolve 才整体resolve
      ? Promise.all(entry.map(handler => handler(payload)))
      // 如果只有一个直接调用
      : entry[0](payload)
  }

  // 监听mutation mutation的时候会调用fn
  // _subscribers 是所有的监听函数
  subscribe (fn) {
    return genericSubscribe(fn, this._subscribers)
  }

  // 监听action action的时候会调用fn
  // _actionSubscribers 是所有的监听函数
  subscribeAction (fn) {
    return genericSubscribe(fn, this._actionSubscribers)
  }

  watch (getter, cb, options) {
    // getter不是一个方法 就直接抛出错误
    if (process.env.NODE_ENV !== 'production') {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    // 监听传入函数的返回值
    // 有改变就调用cb
    // options就是$watch的 option
    return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
  }

  // 直接把所有的state做替换
  replaceState (state) {
    this._withCommit(() => {
      this._vm._data.$$state = state
    })
  }

  registerModule (path, rawModule, options = {}) {
    // 如果只是一个字符串 就构造一个数组
    if (typeof path === 'string') path = [path]

    // path必须是一个长度大于0的数组
    if (process.env.NODE_ENV !== 'production') {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    // 调用register 动态添加module
    this._modules.register(path, rawModule)
    // 下面和初始化逻辑类似
    installModule(this, this.state, path, this._modules.get(path), options.preserveState)
    // reset store to update getters...
    resetStoreVM(this, this.state)
  }

  unregisterModule (path) {
    if (typeof path === 'string') path = [path]

    if (process.env.NODE_ENV !== 'production') {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    // 删除动态注册的module
    this._modules.unregister(path)
    this._withCommit(() => {
      // 当前module的父module
      const parentState = getNestedState(this.state, path.slice(0, -1))
      // 删除
      Vue.delete(parentState, path[path.length - 1])
    })
    // 重置
    resetStore(this)
  }

  hotUpdate (newOptions) {
    this._modules.update(newOptions)
    resetStore(this, true)
  }

  // 执行fn
  _withCommit (fn) {
    // 改变标记位 以防止watch的时候抛异常
    const committing = this._committing
    this._committing = true
    fn()
    this._committing = committing
  }
}

// 就是往数组里面添加函数
function genericSubscribe (fn, subs) {
  // 如果不存在就添加进去
  if (subs.indexOf(fn) < 0) {
    subs.push(fn)
  }
// 返回一个函数 当调用的时候删除这个函数
  return () => {
    const i = subs.indexOf(fn)
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}

function resetStore (store, hot) {
  // 各种状态全置空
  store._actions = Object.create(null)
  store._mutations = Object.create(null)
  store._wrappedGetters = Object.create(null)
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // init all modules
  installModule(store, state, [], store._modules.root, true)
  // reset vm
  resetStoreVM(store, state, hot)
}

// 重置vm
function resetStoreVM (store, state, hot) {
  // 如果第二次调用下面一定有_vm
  // 先给oldVm保存
  const oldVm = store._vm

  // bind store public getters
  //
  store.getters = {}
  // 所有的getter
  const wrappedGetters = store._wrappedGetters
  const computed = {}
  // 遍历所有的getters
  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    // fn就是每一个getter
    // 往computed对象上添加属性
    computed[key] = () => fn(store)
    // 每次访问到store.getters[key]的时候 都会访问下面新建的 _vm[key]
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      enumerable: true // for local getters
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  // 先获取全局配置缓存一下
  const silent = Vue.config.silent
  // 设置成静默
  Vue.config.silent = true
  // 创建一个vue实例放在store下
  // state  computed
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  })
  // 还原之前的全局配置
  Vue.config.silent = silent

  // enable strict mode for new vm
  // 如果配置了严格模式
  if (store.strict) {
    enableStrictMode(store)
  }

  if (oldVm) {
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    Vue.nextTick(() => oldVm.$destroy())
  }
}

function installModule (store, rootState, path, module, hot) {
  //根据path判断 当前install的是否是根module
  const isRoot = !path.length
  // 获取当前的命名空间
  const namespace = store._modules.getNamespace(path)

  // register in namespace map
  if (module.namespaced) {
    // 生成一个 命名空间 到module的映射
    store._modulesNamespaceMap[namespace] = module
  }

  // set state
  if (!isRoot && !hot) {
    // 获取当前module的父module的state
    const parentState = getNestedState(rootState, path.slice(0, -1))
    // 当前module的key
    const moduleName = path[path.length - 1]
    // ？？？变成响应式？
    store._withCommit(() => {
      Vue.set(parentState, moduleName, module.state)
    })
  }

  // 把dispatch commit getters state 都包装一层，对应的key做改变 之后再调用这些方法
  const local = module.context = makeLocalContext(store, namespace, path)

  // 对mutations进行遍历
  // 回调 第一个参数是value 第二个参数是key
  module.forEachMutation((mutation, key) => {
    // 拼接好键
    const namespacedType = namespace + key
    // 把mutation放在_mutations 调用的时候改变this指向
    registerMutation(store, namespacedType, mutation, local)
  })

  // 对每个action遍历
  module.forEachAction((action, key) => {
    // 拼上命名空间
    const type = action.root ? key : namespace + key
    // 有可能是个对象 对象就用handler属性
    const handler = action.handler || action
    // 把action放在_actions 调用的时候改变this指向 并传参
    registerAction(store, type, handler, local)
  })

  // 对每个getter遍历
  module.forEachGetter((getter, key) => {
    // 拼上命名空间
    const namespacedType = namespace + key
    // 直接对_wrappedGetters赋值 一个函数 内部调用传入的getter
    registerGetter(store, namespacedType, getter, local)
  })

  // 遍历所有的子module然后再装载 对立面的方法再包一层
  module.forEachChild((child, key) => {
    // path还是要拼接的
    // module传的是child
    installModule(store, rootState, path.concat(key), child, hot)
  })
}

/**
 * make localized dispatch, commit, getters and state
 * if there is no namespace, just use root ones
 */
function makeLocalContext (store, namespace, path) {
  // 没有命名空间就是在根module上
  const noNamespace = namespace === ''

  const local = {
    // 没有命名空间的直接使用dispatch
    // 有命名空间的要包装一层 再调用dispatch
    // 要对type改变
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      // 统一参数
      const args = unifyObjectStyle(_type, _payload, _options)
      // 获得type payload options
      const { payload, options } = args
      let { type } = args

      // 非根module 要对type添加上命名空间
      if (!options || !options.root) {
        type = namespace + type
        // dispatch的没有再actions中 就输出错误信息
        if (process.env.NODE_ENV !== 'production' && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }

      // 调用dispatch  传入type是加上命名空间之后的
      return store.dispatch(type, payload)
    },

    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      // 统一参数
      const args = unifyObjectStyle(_type, _payload, _options)
      // 获得type payload options
      const { payload, options } = args
      let { type } = args

      // 非根module 要对type添加上命名空间
      if (!options || !options.root) {
        type = namespace + type
        // commit的没有再mutations中 就输出错误信息
        if (process.env.NODE_ENV !== 'production' && !store._mutations[type]) {
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }

      // 调用commit  传入type是加上命名空间之后的
      store.commit(type, payload, options)
    }
  }

  // getters and state object must be gotten lazily
  // because they will be changed by vm update
  // 对state  getters 再包装一层
  Object.defineProperties(local, {
    getters: {
      // 访问getters的时候 如果没有命名空间就直接访问
      get: noNamespace
        ? () => store.getters
        // 有命名空间的再包装一层
        : () => makeLocalGetters(store, namespace)
    },
    state: {
      // 访问state的时候
      get: () => getNestedState(store.state, path)
    }
  })

  return local
}

// 访问有命名空间的getters的时候
function makeLocalGetters (store, namespace) {
  const gettersProxy = {}

  const splitPos = namespace.length
  Object.keys(store.getters).forEach(type => {
    // skip if the target getter is not match this namespace
    // 命名空间对应不上的时候 什么都不做
    // 非当前命名空间下的时候
    if (type.slice(0, splitPos) !== namespace) return

    // extract local getter type
    // 截取命名空间 type对应 localType
    const localType = type.slice(splitPos)

    // Add a port to the getters proxy.
    // Define as getter property because
    // we do not want to evaluate the getters in this time.
    // 当访问到gettersProxy[localType]的时候 相当于访问的是type 截取之前的
    Object.defineProperty(gettersProxy, localType, {
      get: () => store.getters[type],
      enumerable: true
    })
  })

  return gettersProxy
}

function registerMutation (store, type, handler, local) {
  // handler是具体的某个mutation
  // type是已经有命名空间的
  // 往_mutations上添加方法
  const entry = store._mutations[type] || (store._mutations[type] = [])
  // 添加这个方法改变this指向 call store
  entry.push(function wrappedMutationHandler (payload) {
    handler.call(store, local.state, payload)
  })
}

function registerAction (store, type, handler, local) {
  // 往_actions中添加方法
  const entry = store._actions[type] || (store._actions[type] = [])
  entry.push(function wrappedActionHandler (payload, cb) {
    // 调用方法获得返回值
    let res = handler.call(store, {
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state
    }, payload, cb)
    // 判断是不是promise对象
    if (!isPromise(res)) {
      // 不是也就直接调用resolve 当成已完成的
      res = Promise.resolve(res)
    }
    // devtool 发送失败的信息
    if (store._devtoolHook) {
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      return res
    }
  })
}

function registerGetter (store, type, rawGetter, local) {
  // 如果有就证明已经添加过了 就输出错误信息
  if (store._wrappedGetters[type]) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  // 直接赋值
  store._wrappedGetters[type] = function wrappedGetter (store) {
    return rawGetter(
      local.state, // local state
      local.getters, // local getters
      store.state, // root state
      store.getters // root getters
    )
  }
}

// 打开严格模式的时候
function enableStrictMode (store) {
  // 用vm一直watch  store.state的变化  deep可watch子项的变化
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (process.env.NODE_ENV !== 'production') {
      // 改变的时候 如果_committing状态为treu 就直接抛异常
      assert(store._committing, `Do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}

// 访问state的时候
function getNestedState (state, path) {
  return path.length
    // 非根module 访问state 用path拼接一直state.a.b.c 这样获取
    ? path.reduce((state, key) => state[key], state)
    // path为空数组 就直接访问state
    : state
}

// 统一参数
function unifyObjectStyle (type, payload, options) {
  // 改变参数位置
  if (isObject(type) && type.type) {
    options = payload
    payload = type
    type = type.type
  }

  if (process.env.NODE_ENV !== 'production') {
    // type必须是个String类型的
    assert(typeof type === 'string', `Expects string as the type, but found ${typeof type}.`)
  }

  return { type, payload, options }
}

// use的时候调用的是这里
export function install (_Vue) {
  // 判断是否已经install过了
  // Vue 缓存 后面会用到做响应式
  if (Vue && _Vue === Vue) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  // 记录一下
  Vue = _Vue
  // 全局mixin beforeCreate
  applyMixin(Vue)
}
