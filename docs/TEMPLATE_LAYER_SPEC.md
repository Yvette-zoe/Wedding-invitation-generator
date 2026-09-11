# 请柬模板规范 v2

本文档定义婚礼请柬模板的图层命名规范、开发者维护流程以及与终端用户的职责边界。

---

## 一、角色与同步机制

### 终端用户
- 模板对用户**只读**，用户从模板库中选择固定风格
- 用户可编辑的内容：文案（新人姓名、日期、地点等）、宾客名单、婚纱照
- 用户**不**编辑模板结构或图层布局
- 生成个性化请柬时，系统自动将用户文案渲染到模板对应槽位

### 开发者
- 负责模板库的维护：新增、更新、下架模板
- 完成模板制作后发布到模板库，客户端自动同步
- 模板为版本化资源，发布后不可变更；如需修改须发布新版本

### 本地自定义模板
- 高级功能，独立于主模板库路径
- 用户自行上传的模板存储在本地，不进入公共模板库

---

## 二、槽位定义（Photoshop 图层名 = 槽位 ID）

模板中可替换的文案区域通过 Photoshop 图层名标识。**图层名即槽位 ID，必须使用小写英文**。

| 图层名 | 含义 | 是否必需 |
|--------|------|----------|
| `couple` | 新人姓名 | **必需** |
| `date` | 日期（公历/农历） | **必需** |
| `venue` | 地点（酒店/场地） | **必需** |
| `time` | 时间（如"中午十二时正"） | 推荐 |
| `guest` | 宾客称谓（如"尊敬的 张三 先生"） | 推荐（无此槽位时跳过逐客替换） |
| `host` | 落款（如"双方家长 敬邀"） | 推荐 |
| `closing` | 敬语（如"恭请光临"） | 推荐 |
| `photo` | 婚纱照占位区 | 可选 |

### 其他图层分组约定
- **装饰元素**：放入 `decor` 图层组
- **背景**：图层名为 `bg` 或 `background`
- 每个槽位只能有一个图层，不允许重复

---

## 三、横排与竖排

### 横排（现代风格）
- 默认排版方式
- 布局 JSON 中 `vertical: false` 或省略

### 竖排（传统中式）
- 图层名添加 `#vertical` 后缀，如 `couple#vertical`
- 或在布局 JSON 中设置 `vertical: true`
- 竖排文本框应为**瘦高矩形**（高度 > 宽度 × 1.25 时自动识别为竖排）

### 混合排版
- 同一模板可混用横排与竖排槽位
- 模板标签应包含 `竖排` 或 `横排` 以便筛选

---

## 四、开发者模板制作流程

```
┌─────────────────────────────────────────────────────────────────┐
│  1. 上传目标风格的成品请柬图片                                    │
│     ↓                                                           │
│  2. 视觉模型 (Vision LLM) 分析 → 输出 TemplateLayout             │
│     （包含各槽位位置、尺寸、字号、对齐、是否竖排）                  │
│     ↓                                                           │
│  3. 在 Photoshop 中按本规范整理图层                               │
│     - 图层名 = 槽位 ID                                           │
│     - 装饰放入 decor 组                                          │
│     - 背景命名为 bg / background                                 │
│     ↓                                                           │
│  4. 导出三件套：                                                 │
│     - sample：成品请柬（含示例文案）                              │
│     - background：空白底图（文字槽位清空，保留装饰和背景）         │
│     - layout.json：TemplateLayout 布局描述                       │
│     ↓                                                           │
│  5. 发布到模板库 → 客户端自动同步                                 │
│     ↓                                                           │
│  6. 用户选择模板 → 编辑文案 → 生成个性化请柬                      │
└─────────────────────────────────────────────────────────────────┘
```

**重要说明**：
- 用户永远不接触 Photoshop；PS + MCP 仅用于开发者制作模板
- 流程顺序：**先**用视觉模型解析，**再**在 Photoshop 整理图层

---

## 五、导出物与库元数据

### 模板三件套
| 文件 | 说明 |
|------|------|
| `sample.jpg` / `sample.png` | 成品请柬，含示例文案，用于模板选择页封面 |
| `background.jpg` / `background.png` | 空白底图，文字槽位清空，保留装饰与背景 |
| `layout.json` | `TemplateLayout` 结构，描述各槽位坐标、尺寸、字号等 |

### 模板库元数据字段
```typescript
interface Template {
  id: string;           // 唯一标识
  name: string;         // 模板名称
  description: string;  // 模板描述
  tags: string[];       // 标签，如 ["中式", "竖排", "喜庆"]
  style: 'custom-image';// 自定义图片模板
  sampleUrl: string;    // 成品请柬 URL
  backgroundUrl: string;// 空白底图 URL
  layout: TemplateLayout;
  updatedAt: string;    // 更新时间 / 版本标记
}
```

---

## 六、反模式（常见错误）

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| 使用中文图层名，如"新人姓名" | 使用小写英文，如 `couple` |
| 宾客称谓直接写死在背景图上 | 保留 `guest` 槽位，由系统动态替换 |
| 只导出一张成品图，无空白底图 | 必须同时导出 sample 和 background |
| 将婚纱照标注为文字图层 | `photo` 槽位应标记照片区域，而非文字 |
| 图层名大小写混用，如 `Couple` | 统一使用小写，如 `couple` |

---

## 七、代码对照

本规范与现有代码的对应关系（仅供参考，本文档不涉及代码变更）：

| 规范概念 | 代码位置 | 说明 |
|----------|----------|------|
| `TemplateLayout` | `src/types.ts` | 布局描述结构 |
| `LayoutSlot` | `src/types.ts` | 槽位类型定义 |
| `LayoutRegion` | `src/types.ts` | 单个槽位的坐标、样式信息 |
| `Template.style: 'custom-image'` | `src/types.ts` | 自定义图片模板标识 |
| `analyzeInvitation` | `src/api/vision.ts` | 视觉模型解析入口 |
| `normalizeLayout` | `src/layout.ts` | 布局数据标准化 |
| `normalizeSlot` | `src/layout.ts` | 槽位名称归一化映射 |

---

## 八、槽位类型定义（TypeScript 参考）

```typescript
export type LayoutSlot =
  | 'couple'   // 新人姓名
  | 'date'     // 日期
  | 'time'     // 时间
  | 'venue'    // 地点
  | 'guest'    // 宾客称谓
  | 'host'     // 落款
  | 'closing'  // 敬语
  | 'photo';   // 婚纱照占位

export interface LayoutRegion {
  slot: LayoutSlot;
  x: number;        // 左上角 X 坐标（像素）
  y: number;        // 左上角 Y 坐标（像素）
  w: number;        // 宽度（像素）
  h: number;        // 高度（像素）
  fontSize: number; // 字号
  fontWeight: number;
  align: 'left' | 'center' | 'right';
  color?: string;
  label: string;    // 中文标签
  sample: string;   // 示例文本
  vertical?: boolean; // 是否竖排
}

export interface TemplateLayout {
  width: number;    // 图片宽度（像素）
  height: number;   // 图片高度（像素）
  regions: LayoutRegion[];
  summary: string;  // 版式概述
}
```

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v2 | 2026-09 | 明确角色分工、竖排标记规范、反模式清单 |
| v1 | - | 初始槽位定义 |
