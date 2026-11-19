import { expect, test } from 'bun:test';
import { getMarkdownRenderer } from '../src/utils/markdown.js';

test.each([
    ['这是**重现步骤**', '这是<strong>重现步骤</strong>'],
    ['<em>原文</em>', '&lt;em&gt;原文&lt;/em&gt;'],
    ['一\n\n二', '<p>一</p>\n<p>二</p>\n'],
    ['- 登录\n- 保存', '<ul>\n<li>登录</li>\n<li>保存</li>\n</ul>\n'],
    ['```\n<code>\n```', '<pre><code>&lt;code&gt;\n</code></pre>\n'],
    ['', ''],
    ['![**截图**](<file:~/相 册/图.png> "预览")', '<img src="file:~/相 册/图.png" alt="截图" title="预览">'],
    ['![已有](file:42)', '<img src="file:42" alt="已有">'],
    ['[链接](file:./a.png) ![站内](../a.png)', '[链接](file:./a.png) <img src="../a.png" alt="站内">'],
    ['```\n![图片](file:./a.png)\n```', '<pre><code>![图片](file:./a.png)\n</code></pre>\n'],
])('renders Markdown field %j', async (input, expected) => {
    const render = await getMarkdownRenderer();
    expect(render(input)).toBe(expected);
});
