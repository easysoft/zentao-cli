import type { ModuleDefinition } from '../types/index.js';

/**
 * 内置模块注册表：key 为 CLI 子命令名（小写），value 为对应禅道 REST 资源元数据。
 * 新增模块时在此表中补充定义，并由 `registerModuleCommands` 动态注册命令。
 */
export const MODULES: ModuleDefinition[] = [
    /* 用户模块 */
    {
        name: 'user',
        display: '用户',
        description: '用户管理，支持获取用户列表、获取用户详情、创建用户、修改用户、删除用户',
        actions: [
            {
                name: 'list',
                display: '获取用户列表',
                type: 'list',
                method: 'get',
                path: '/users',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'users',
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '浏览类型',
                        defaultValue: 'inside',
                        options: [
                            { value: 'inside', label: '内部用户' },
                            { value: 'outside', label: '外部用户' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
                        defaultValue: 'id_asc',
                        options: [
                            { value: 'id_asc', label: 'ID 升序' },
                            { value: 'id_desc', label: 'ID 降序' },
                            { value: 'realname_asc', label: '姓名 升序' },
                            { value: 'realname_desc', label: '姓名 降序' },
                            { value: 'account_asc', label: '用户名 升序' },
                            { value: 'account_desc', label: '用户名 降序' },
                        ],
                    },
                    {
                        name: 'recPerPage',
                        required: true,
                        type: 'number',
                        description: '每页记录数',
                    },
                    {
                        name: 'pageID',
                        required: true,
                        type: 'number',
                        description: '页码',
                    },
                ]
            }, {
                name: 'create',
                display: '创建用户',
                type: 'create',
                method: 'post',
                path: '/users',
                resultType: 'object',
            }, {
                name: 'get',
                display: '获取用户详情',
                type: 'get',
                method: 'get',
                path: '/users/{userID}',
                resultType: 'object',
                resultGetter: 'user',
                pathParams: {
                    userID: '用户ID',
                },
            }, {
                name: 'update',
                display: '更新用户',
                type: 'update',
                method: 'put',
                path: '/users/{userID}',
                resultType: 'object',
                pathParams: {
                    userID: '用户ID',
                },
                requestBody: {
                    type: 'object',
                    schema: {
                        type: 'object',
                        properties: {
                            realname: {
                                type: "string",
                                description: "真实姓名"
                            },
                            dept: {
                                type: "integer",
                                description: "部门",
                                format: "int32"
                            },
                            join: {
                                type: "string",
                                description: "入职日期"
                            },
                            group: {
                                type: "array",
                                items: {
                                type: "string"
                                },
                                description: "权限分组"
                            },
                            email: {
                                type: "string",
                                description: "邮箱"
                            },
                            visions: {
                                type: "array",
                                items: {
                                    type: "string"
                                },
                                description: "界面类型(研发综合界面 rnd | 运营管理界面 lite)"
                            },
                            mobile: {
                                type: "string",
                                description: "手机"
                            },
                            weixin: {
                                type: "string",
                                description: "微信"
                            },
                            password: {
                                type: "string",
                                description: "密码"
                            }
                        },
                    },
                },
            }, {
                name: 'delete',
                display: '删除用户',
                type: 'delete',
                method: 'delete',
                path: '/users/{userID}',
                resultType: 'text',
                pathParams: {
                    userID: '用户ID',
                },
                render: 'action',
            }
        ],
    },

    /* BUG 模块 */
    {
        name: 'bug',
        display: 'Bug',
        description: 'Bug 管理，支持获取产品/项目/执行下的Bug列表、获取Bug详情、创建Bug、修改Bug、删除Bug、解决BUG、关闭BUG和激活BUG',
        actions: [
            {
                name: 'list',
                display: '获取Bug列表，支持获取产品/项目/执行下的Bug',
                type: 'list',
                method: 'get',
                /* 通过定义 scope 参数，兼容了不同范围的BUG列表查询，这样需要一个列表命令即可查询不同范围的BUG列表 */
                path: '/{scope}/{productID}/bugs',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'bugs',
                pathParams: {
                    scope: {description: 'BUG范围', options: [{value: 'products', label: '产品'}, {value: 'projects', label: '项目'}, {value: 'executions', label: '执行'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '状态',
                        defaultValue: 'unclosed',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'unclosed', label: '未关闭' },
                            { value: 'assignedtome', label: '指派给我' },
                            { value: 'openedbyme', label: '我创建' },
                            { value: 'assignedbyme', label: '由我指派' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
                        defaultValue: 'id_asc',
                        options: [
                            { value: 'id_asc', label: 'ID 升序' },
                            { value: 'id_desc', label: 'ID 降序' },
                            { value: 'title_asc', label: '标题 升序' },
                            { value: 'title_desc', label: '标题 降序' },
                            { value: 'status_asc', label: '状态 升序' },
                            { value: 'status_desc', label: '状态 降序' },
                        ],
                    },
                    {
                        name: 'recPerPage',
                        required: false,
                        type: 'number',
                        description: '每页数量，不超过1000',
                    },
                    {
                        name: 'pageID',
                        required: false,
                        type: 'number',
                        description: '页码，从第1页开始',
                    },
                ],
            }, {
                name: 'get',
                display: '获取Bug详情',
                type: 'get',
                method: 'get',
                path: '/bugs/{bugID}',
                resultType: 'object',
                resultGetter: 'bug',
                pathParams: {
                    bugID: 'Bug ID',
                },
            }, {
                name: 'create',
                display: '创建Bug',
                type: 'create',
                method: 'post',
                path: '/bugs',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        type: 'object',
                        properties: {
                            productID: {
                                type: 'integer',
                                description: '所属产品',
                                format: 'int32',
                            },
                            title: {
                                type: 'string',
                                description: 'Bug标题',
                            },
                            openedBuild: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '影响版本,主干是trunk，其他版本使用版本ID',
                            },
                            project: {
                                type: 'integer',
                                description: '所属项目',
                                format: 'int32',
                            },
                            execution: {
                                type: 'integer',
                                description: '所属执行',
                                format: 'int32',
                            },
                            severity: {
                                type: 'integer',
                                description: '严重程度，默认是3',
                                format: 'int32',
                            },
                            pri: {
                                type: 'integer',
                                description: '优先级，默认是3',
                                format: 'int32',
                            },
                            type: {
                                type: 'string',
                                description: 'Bug类型(codeerror 代码错误 | config 配置相关 | install 安装部署 | security 安全相关 | performance 性能问题 | standard 标准规范 | automation 测试脚本 | designdefect 设计缺陷 | others 其他)',
                            },
                            steps: {
                                type: 'string',
                                description: '重现步骤',
                            },
                            story: {
                                type: 'integer',
                                description: '相关需求',
                                format: 'int32',
                            },
                        },
                        required: ['productID', 'title', 'openedBuild'],
                    },
                },
            }, {
                name: 'update',
                display: '修改Bug',
                type: 'update',
                method: 'put',
                path: '/bugs/{bugID}',
                resultType: 'object',
                pathParams: {
                    bugID: 'Bug ID',
                },
                requestBody: {
                    type: 'object',
                    schema: {
                        type: 'object',
                        properties: {
                            title: {
                                type: 'string',
                                description: 'Bug标题',
                            },
                            severity: {
                                type: 'integer',
                                description: '严重程度，默认是3',
                                format: 'int32',
                            },
                            pri: {
                                type: 'integer',
                                description: '优先级，默认是3',
                                format: 'int32',
                            },
                            type: {
                                type: 'string',
                                description: 'Bug类型(codeerror 代码错误 | config 配置相关 | install 安装部署 | security 安全相关 | performance 性能问题 | standard 标准规范 | automation 测试脚本 | designdefect 设计缺陷 | others 其他)',
                            },
                            openedBuild: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '影响版本,主干是trunk，其他版本使用版本ID',
                            },
                            steps: {
                                type: 'string',
                                description: '重现步骤',
                            },
                            project: {
                                type: 'integer',
                                description: '所属项目',
                                format: 'int32',
                            },
                            execution: {
                                type: 'integer',
                                description: '所属执行',
                                format: 'int32',
                            },
                            story: {
                                type: 'integer',
                                description: '相关需求',
                                format: 'int32',
                            },
                        },
                    },
                },
            }, {
                name: 'delete',
                display: '删除Bug',
                type: 'delete',
                method: 'delete',
                path: '/bugs/{bugID}',
                resultType: 'text',
                pathParams: {
                    bugID: 'Bug ID',
                },
                render: 'action',
            }, {
                name: 'resolve',
                display: '解决Bug',
                type: 'action',
                method: 'put',
                path: '/bugs/{bugID}/resolve',
                resultType: 'text',
                pathParams: {
                    bugID: 'Bug ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        type: 'object',
                        properties: {
                            resolution: {
                                type: 'string',
                                description: '解决方案(fixed 已解决 | notrepro 无法重现 | bydesign 设计如此 | duplicate 重复Bug | external 外部原因 | postponed 延期处理 | willnotfix 不予解决 | tostory 转为需求)',
                            },
                            resolvedDate: {
                                type: 'string',
                                description: '解决日期，默认今天',
                            },
                            resolvedBuild: {
                                type: 'string',
                                description: '解决版本, trunk为主干',
                            },
                            assignedTo: {
                                type: 'string',
                                description: '指派给',
                            },
                            comment: {
                                type: 'string',
                                description: '备注',
                            },
                        },
                        required: ['resolution'],
                    },
                },
                render: 'action',
            }, {
                name: 'close',
                display: '关闭Bug',
                type: 'action',
                method: 'put',
                path: '/bugs/{bugID}/close',
                resultType: 'text',
                pathParams: {
                    bugID: 'Bug ID',
                },
                requestBody: {
                    type: 'object',
                    schema: {
                        type: 'object',
                        properties: {
                            comment: {
                                type: 'string',
                                description: '备注',
                            },
                        },
                    },
                },
                render: 'action',
            }, {
                name: 'activate',
                display: '激活Bug',
                type: 'action',
                method: 'put',
                path: '/bugs/{bugID}/activate',
                resultType: 'text',
                pathParams: {
                    bugID: 'Bug ID',
                },
                requestBody: {
                    type: 'object',
                    schema: {
                        type: 'object',
                        properties: {
                            openedBuild: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '影响版本, trunk为主干',
                            },
                            assignedTo: {
                                type: 'string',
                                description: '指派给',
                            },
                            comment: {
                                type: 'string',
                                description: '备注',
                            },
                        },
                    },
                },
                render: 'action',
            },
        ],
    },
];
