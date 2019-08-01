import Module from './module'
import { assert, forEachValue } from '../util'

export default class ModuleCollection {
  // 传入的rawRootModule 就是创建store的时候的options
  constructor (rawRootModule) {
    // register root module (Vuex.Store options)
    // 根module的path为空  不是在运行时动态添加的
    this.register([], rawRootModule, false)
  }


  // 通过 ['a', 'b', 'c'] 找到{a:{b:{c:{}}}}
  // 最终找到对应的module对象
  get (path) {
    // reduce 从this.root当做第一个参数开始 遍历path 把上一次的返回值当做下一次的参数
    // module 上一次计算的
    // key 当前遍历的path中一项
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }

  // 获取命名空间
  getNamespace (path) {
    // 从根开始找 默认namespace为空字符串
    let module = this.root
    return path.reduce((namespace, key) => {
      // 通过path中的一项获取到子module 赋值给外层遍历记录
      module = module.getChild(key)
      // 继续拼接  如果设置了命名空间，就拼接上/ 没有就为空字符串
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  // 类中的update 调用外面的update方法
  update (rawRootModule) {
    // 传入的是this.root现有的根module对象  还有update要更新的未加工的option
    update([], this.root, rawRootModule)
  }

  // 不传runtime 默认就是在运行时动态添加的
  register (path, rawModule, runtime = true) {
    // 检查getters，mutations，actions 的每一项是否符合要求
    if (process.env.NODE_ENV !== 'production') {
      assertRawModule(path, rawModule)
    }

    // 创建一个Module对象 根module  子module
    const newModule = new Module(rawModule, runtime)
    // 如果path是[] 这个就是根
    if (path.length === 0) {
      // 通过root记录根module
      this.root = newModule
    } else {
      // path删除最后一个，找到当前的父module
      const parent = this.get(path.slice(0, -1))
      // 把当前module 添加到父module中 建立父子关系
      parent.addChild(path[path.length - 1], newModule)
    }

    // register nested modules
    // 当前module是否还是子module
    if (rawModule.modules) {
      // 遍历子module
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        // 拼接path 继续添加递归调用register 建立父子关系
        // 当前path继续添加key key就是modules中的对应的key
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }

  // 取消注册
  unregister (path) {
    // 根据path获取当前module的父级
    const parent = this.get(path.slice(0, -1))
    // 到父元素的key
    const key = path[path.length - 1]
    // 如果不是动态添加的 不能删除
    // 动态添加的 才能删除
    if (!parent.getChild(key).runtime) return

    // 直接调用remove删除这个children
    parent.removeChild(key)
  }
}

function update (path, targetModule, newModule) {
  // 对于新传入的option还要做一次检查 看值是否符合类型
  if (process.env.NODE_ENV !== 'production') {
    assertRawModule(path, newModule)
  }

  // update target module
  // 调用传入要改变的module对象的update 这里只能改当前module的不能改_children的
  targetModule.update(newModule)

  // update nested modules
  // 判断是否还有子module
  if (newModule.modules) {
    // 遍历子module
    for (const key in newModule.modules) {
      // 判断如果现在没有这个子module 就报警告  有可能热更新没成功
      if (!targetModule.getChild(key)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
            'manual reload is needed'
          )
        }
        return
      }
      // 拼接path继续递归 直到所有的都更新完成
      update(
        path.concat(key),
        targetModule.getChild(key),
        newModule.modules[key]
      )
    }
  }
}

// 判断是否是个函数
const functionAssert = {
  assert: value => typeof value === 'function',
  expected: 'function'
}

// 要么本身是个函数  要么本身是个对象必须有一个属性为handler的函数
const objectAssert = {
  assert: value => typeof value === 'function' ||
    (typeof value === 'object' && typeof value.handler === 'function'),
  expected: 'function or object with "handler" function'
}

const assertTypes = {
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert
}

function assertRawModule (path, rawModule) {
  // 遍历assertTypes key就是getters，mutations，actions
  Object.keys(assertTypes).forEach(key => {
    // 传入的option没有这个就继续下次循环
    if (!rawModule[key]) return

    // assertTypes中对应的检查函数
    const assertOptions = assertTypes[key]

    // 遍历 option.getters的每一项 然后判断类型是否符合
    forEachValue(rawModule[key], (value, type) => {
      assert(
        // 调用对应的检查函数检查 如果检查不通过 就抛出异常
        assertOptions.assert(value),
        // 拼接异常信息
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      )
    })
  })
}

// 拼接信息 最后返回
function makeAssertionMessage (path, key, type, value, expected) {
  let buf = `${key} should be ${expected} but "${key}.${type}"`
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`
  }
  buf += ` is ${JSON.stringify(value)}.`
  return buf
}
