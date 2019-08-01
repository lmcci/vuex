export const mapState = normalizeNamespace((namespace, states) => {
  const res = {}
  // 序列化state然后遍历
  normalizeMap(states).forEach(({ key, val }) => {
    // 每个state的key当做参数 放在res中一个函数 其实最后会在computed中 计算属性的值是一个函数 使用的时候是使用这个函数的返回值
    res[key] = function mappedState () {
      //
      let state = this.$store.state
      let getters = this.$store.getters
      if (namespace) {
        // 用命名空间的 拿到命名空间对应的module
        const module = getModuleByNamespace(this.$store, 'mapState', namespace)
        if (!module) {
          return
        }
        // 从module中拿到state getters 后面当成参数传入
        // 就是之前构建的local
        state = module.context.state
        getters = module.context.getters
      }
      // 如果state的函数 就调用并改变上下文
      // 不是函数直接返回值
      return typeof val === 'function'
        ? val.call(this, state, getters)
        : state[val]
    }

    // mark vuex getter for devtools
    res[key].vuex = true
  })
  return res
})

// 下面的都相同
export const mapMutations = normalizeNamespace((namespace, mutations) => {
  const res = {}
  normalizeMap(mutations).forEach(({ key, val }) => {
    res[key] = function mappedMutation (...args) {
      let commit = this.$store.commit
      // 有命名空间的重新赋值
      if (namespace) {
        const module = getModuleByNamespace(this.$store, 'mapMutations', namespace)
        if (!module) {
          return
        }
        commit = module.context.commit
      }
      return typeof val === 'function'
        ? val.apply(this, [commit].concat(args))
        : commit.apply(this.$store, [val].concat(args))
    }
  })
  return res
})

export const mapGetters = normalizeNamespace((namespace, getters) => {
  const res = {}
  normalizeMap(getters).forEach(({ key, val }) => {
    val = namespace + val
    res[key] = function mappedGetter () {
      if (namespace && !getModuleByNamespace(this.$store, 'mapGetters', namespace)) {
        return
      }
      if (process.env.NODE_ENV !== 'production' && !(val in this.$store.getters)) {
        console.error(`[vuex] unknown getter: ${val}`)
        return
      }
      return this.$store.getters[val]
    }
    // mark vuex getter for devtools
    res[key].vuex = true
  })
  return res
})

export const mapActions = normalizeNamespace((namespace, actions) => {
  const res = {}
  normalizeMap(actions).forEach(({ key, val }) => {
    res[key] = function mappedAction (...args) {
      let dispatch = this.$store.dispatch
      if (namespace) {
        const module = getModuleByNamespace(this.$store, 'mapActions', namespace)
        if (!module) {
          return
        }
        dispatch = module.context.dispatch
      }
      return typeof val === 'function'
        ? val.apply(this, [dispatch].concat(args))
        : dispatch.apply(this.$store, [val].concat(args))
    }
  })
  return res
})

export const createNamespacedHelpers = (namespace) => ({
  mapState: mapState.bind(null, namespace),
  mapGetters: mapGetters.bind(null, namespace),
  mapMutations: mapMutations.bind(null, namespace),
  mapActions: mapActions.bind(null, namespace)
})

// 格式化一个对象 [{key:k, val:v}]
function normalizeMap (map) {
  return Array.isArray(map)
    ? map.map(key => ({ key, val: key }))
    : Object.keys(map).map(key => ({ key, val: map[key] }))
}

// 格式化调用的参数
function normalizeNamespace (fn) {
// 使用的时候调用 如 mapState(a, b) 就是走这个方法
  return (namespace, map) => {
    // 修正参数位置
    if (typeof namespace !== 'string') {
      map = namespace
      namespace = ''
    } else if (namespace.charAt(namespace.length - 1) !== '/') {
      // 不以/结尾的添加上
      namespace += '/'
    }
    return fn(namespace, map)
  }
}

// 通过命名空间获得module对象
function getModuleByNamespace (store, helper, namespace) {
  // 初始化的时候有构造一个map 这里可以直接取
  const module = store._modulesNamespaceMap[namespace]
  // 如果没有就警告
  if (process.env.NODE_ENV !== 'production' && !module) {
    console.error(`[vuex] module namespace not found in ${helper}(): ${namespace}`)
  }
  return module
}
