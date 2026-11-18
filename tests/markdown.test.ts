import { expect, test } from 'bun:test';
import { getMarkdownRenderer } from '../src/utils/markdown.js';

test.each([
    ['这是**重现步骤**', '这是<strong>重现步骤</strong>'],
    ['<em>原文</em>', '&lt;em&gt;原文&lt;/em&gt;'],
    ['一\n\n二', '<p>一</p>\n<p>二</p>\n'],
    ['- 登录\n- 保存', '<ul>\n<li>登录</li>\n<li>保存</li>\n</ul>\n'],
    ['```\n<code>\n```', '<pre><code>&lt;code&gt;\n</code></pre>\n'],
    ['', ''],
])('renders Markdown field %j', async (input, expected) => {
    const render = await getMarkdownRenderer();
    expect(render(input)).toBe(expected);
});
