export type InterviewModule = {
  id: number;
  title: string;
  /** First assistant turn in this module (verbatim). */
  cannedOpener: string;
  /** Shuffled with other middle modules; 0 and 7 stay fixed at ends. */
  shuffleable: boolean;
};

export const MODULES: InterviewModule[] = [
  {
    id: 0,
    title: "开场",
    shuffleable: false,
    cannedOpener: `你好，我叫stone，很高兴认识你。我们会聊一些关于你的经历和看法。请尽量避免在回答中使用真实姓名，请尽量使用“我叫Jacky”，“我的朋友小刘，老李”，“我的男朋友zz”类似的名称（网络名人如周杰伦，特朗普，除外）

在开始之前，请问：你现在多大了，在哪个城市生活，做什么工作或者在读什么专业？`,
  },
  {
    id: 1,
    title: "人生故事",
    shuffleable: true,
    cannedOpener: `首先，我想请你从头讲讲你的人生故事——从你的童年开始，包括你的成长环境、求学经历、重要的人际关系，以及任何你觉得对你影响深远的重大事件。请随意讲，不用担心顺序。`,
  },
  {
    id: 2,
    title: "人生十字路口",
    shuffleable: true,
    cannedOpener: `很多人在人生中都会遇到十字路口——面临多个选择，而最终的决定深深影响了他们后来的路。你有过这样的时刻吗？能讲讲那段经历的来龙去脉吗？`,
  },
  {
    id: 3,
    title: "重要的人",
    shuffleable: true,
    cannedOpener: `说说你生命中对你最重要的人——可以是家人、朋友、老师、伴侣，或者任何人。他们对你有什么影响？`,
  },
  {
    id: 4,
    title: "当下的生活",
    shuffleable: true,
    cannedOpener: `现在说说你目前的生活吧。你现在住在哪里，日常生活是什么样的？你觉得现在的生活和你年轻时想象的一样吗？`,
  },
  {
    id: 5,
    title: "价值观与信念",
    shuffleable: true,
    cannedOpener: `你最看重生活中的什么？你的核心价值观是什么——比如家庭、事业、自由、公平……你觉得这些信念是从哪里来的？`,
  },
  {
    id: 6,
    title: "对未来的希望",
    shuffleable: true,
    cannedOpener: `我想再聊聊你对未来的想象：想象几年后的自己，你希望那时候的生活是什么样的？有没有什么特别想做、想实现的事情？`,
  },
  {
    id: 7,
    title: "收尾",
    shuffleable: false,
    cannedOpener: `非常感谢你今天愿意和我分享这么多！你的故事很有价值，也让我对你有了更深的了解。在结束之前，有没有什么你想补充的，或者有什么你希望我知道但今天没有聊到的？`,
  },
];

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function getModule(id: number): InterviewModule {
  const m = BY_ID.get(id);
  if (!m) throw new Error(`Unknown module id: ${id}`);
  return m;
}

/** Fisher–Yates shuffle (in-place copy). */
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Fixed 0 at start, 7 at end; modules 1–6 in random order.
 */
export function buildModuleOrder(): number[] {
  const middle = MODULES.filter((m) => m.shuffleable).map((m) => m.id);
  shuffleInPlace(middle);
  return [0, ...middle, 7];
}
