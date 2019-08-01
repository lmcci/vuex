// Credits: borrowed code from fcomb/redux-logger

import { deepCopy } from '../util'

// 传入的参数是个对象 每个都有默认值
export default function createLogger ({
  collapsed = true, // 默认不展开
  filter = (mutation, stateBefore, stateAfter) => true,   // 默认所有的都不过滤掉
  transformer = state => state,   // 默认不转换格式
  mutationTransformer = mut => mut, // 默认不转换格式
  logger = console  // 默认使用console输出log
} = {}) {
  return store => {
    // 把当前的state拷贝一份
    let prevState = deepCopy(store.state)

    // 订阅store的变化  当有改变的时候走回调
    store.subscribe((mutation, state) => {
      // 如果没有console 或者 输出的对象 就什么都不干了
      if (typeof logger === 'undefined') {
        return
      }
      // 拷贝变化之后的state
      const nextState = deepCopy(state)

      // 是否要过滤某一个 state mutation
      if (filter(mutation, prevState, nextState)) {
        // 格式化输出 时间信息
        const time = new Date()
        const formattedTime = ` @ ${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(time.getSeconds(), 2)}.${pad(time.getMilliseconds(), 3)}`
        // 格式化输出的mutation
        const formattedMutation = mutationTransformer(mutation)
        // 组装输出的信息
        const message = `mutation ${mutation.type}${formattedTime}`
        // 是否要展开信息 调用console的方法
        const startMessage = collapsed
          ? logger.groupCollapsed
          : logger.group

        // render
        // 输出组装的信息 mutation.type 以及格式化的时间
        try {
          startMessage.call(logger, message)
        } catch (e) {
          console.log(message)
        }

        // 上次的state
        logger.log('%c prev state', 'color: #9E9E9E; font-weight: bold', transformer(prevState))
        // 格式化之后的mutation
        logger.log('%c mutation', 'color: #03A9F4; font-weight: bold', formattedMutation)
        // 当前的state
        logger.log('%c next state', 'color: #4CAF50; font-weight: bold', transformer(nextState))

        // 闭合 日志
        try {
          logger.groupEnd()
        } catch (e) {
          logger.log('—— log end ——')
        }
      }

      // 把当前的state 当做上次的state 后面继续可以使用
      prevState = nextState
    })
  }
}

// 重复拼接字符串N次
function repeat (str, times) {
  // 创建一个长度为N+1的空数组  然后用join拼接
  // 个数是N+1  中间有N个空间 相当于重复N次
  return (new Array(times + 1)).join(str)
}

// 返回一个字符串, 长度是maxLength  num不足的前面用0拼接
// pad(66, 10) ===>  "0000000066"
function pad (num, maxLength) {
  // 最大长度减去num的长度 0重复这么多次  然后字符串拼接 num 最终返回字符串
  return repeat('0', maxLength - num.toString().length) + num
}
