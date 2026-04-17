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
    cannedOpener: `我们先从你长大的地方开始聊吧——你是在哪里长大的？`,
  },
  {
    id: 2,
    title: "人生十字路口",
    shuffleable: true,
    cannedOpener: `你有没有做过一个决定，后来觉得它改变了你后来的路？`,
  },
  {
    id: 3,
    title: "重要的人",
    shuffleable: true,
    cannedOpener: `你生命里有没有一个人，是你特别想聊聊的？`,
  },
  {
    id: 4,
    title: "当下的生活",
    shuffleable: true,
    cannedOpener: `说说你现在的日子吧，最近的生活状态是怎么样的？`,
  },
  {
    id: 5,
    title: "价值观与信念",
    shuffleable: true,
    cannedOpener: `你最在乎的是什么？`,
  },
  {
    id: 6,
    title: "对未来的希望",
    shuffleable: true,
    cannedOpener: `往后的日子，你最想要的是什么？`,
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
