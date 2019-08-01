// devtools 会挂载在window上__VUE_DEVTOOLS_GLOBAL_HOOK__对象
const devtoolHook =
  typeof window !== 'undefined' &&
  window.__VUE_DEVTOOLS_GLOBAL_HOOK__

export default function devtoolPlugin (store) {
  // 如果没有打开 devtools 就直接return
  if (!devtoolHook) return

  // 赋值给store
  // vuex里面如果有错误的话可以通过devtoolHook emit错误信息
  store._devtoolHook = devtoolHook

  // 初始化的时候 emit一次
  devtoolHook.emit('vuex:init', store)

  // 监听 当用devtool的时候改变数据
  devtoolHook.on('vuex:travel-to-state', targetState => {
    store.replaceState(targetState)
  })

  // 改变的时候emit一次
  store.subscribe((mutation, state) => {
    devtoolHook.emit('vuex:mutation', mutation, state)
  })
}
