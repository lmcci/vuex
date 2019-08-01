import { Store, install } from './store'
import { mapState, mapMutations, mapGetters, mapActions, createNamespacedHelpers } from './helpers'

// 使用的时候 通过import获得的是这个对象
export default {
  Store,  // vuex构造方法
  install,  // use的时候调用这个
  version: '__VERSION__',
  mapState, // 下面四个都是语法糖 包装一次
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers
}
