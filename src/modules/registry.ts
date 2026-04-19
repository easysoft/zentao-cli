import type { ModuleDefinition } from '../types/index.js';

/**
 * 内置模块注册表：key 为 CLI 子命令名（小写），value 为对应禅道 REST 资源元数据。
 * 新增模块时在此表中补充定义，并由 `registerModuleCommands` 动态注册命令。
 *
 * 此文件由 scripts/update-registry.ts 自动生成，请勿手动编辑。
 */
export const MODULES: ModuleDefinition[] = [
    /* 用户模块 */
    {
        name: 'user',
        display: '用户',
        description: '用户管理，支持获取用户列表、创建用户、获取用户详情、修改用户信息、删除用户',
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
                        options: [
                            { value: 'inside', label: '内部用户' },
                            { value: 'outside', label: '内部用户' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
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
                name: 'create',
                display: '创建用户',
                type: 'create',
                method: 'post',
                path: '/users',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "account": {
                                "type": "string",
                                "description": "登录名"
                            },
                            "realname": {
                                "type": "string",
                                "description": "姓名"
                            },
                            "password": {
                                "type": "string",
                                "description": "密码"
                            }
                        },
                        "required": [
                            "account",
                            "realname",
                            "password"
                        ]
                    },
                },
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
                display: '修改用户信息',
                type: 'update',
                method: 'put',
                path: '/users/{userID}',
                resultType: 'object',
                pathParams: {
                    userID: '用户ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "realname": {
                                "type": "string",
                                "description": "真实姓名"
                            },
                            "dept": {
                                "type": "integer",
                                "description": "部门",
                                "format": "int32"
                            },
                            "join": {
                                "type": "string",
                                "description": "入职日期"
                            },
                            "group": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "权限分组"
                            },
                            "email": {
                                "type": "string",
                                "description": "邮箱"
                            },
                            "visions": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "界面类型(研发综合界面 rnd | 运营管理界面 lite)"
                            },
                            "mobile": {
                                "type": "string",
                                "description": "手机"
                            },
                            "weixin": {
                                "type": "string",
                                "description": "微信"
                            },
                            "password": {
                                "type": "string",
                                "description": "密码"
                            }
                        }
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

    /* 项目集模块 */
    {
        name: 'program',
        display: '项目集',
        description: '项目集管理，支持获取项目集列表、创建项目集、获取项目集详情、修改项目集、删除项目集',
        actions: [
            {
                name: 'list',
                display: '获取项目集列表',
                type: 'list',
                method: 'get',
                path: '/programs',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'programs',
                params: [
                    {
                        name: 'status',
                        required: false,
                        type: 'string',
                        description: '状态',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'unclosed', label: '未关闭' },
                            { value: 'wait', label: '未开始' },
                            { value: 'doing', label: '进行中' },
                            { value: 'suspended', label: '已挂起' },
                            { value: 'delayed', label: '已延期' },
                            { value: 'closed', label: '已关闭' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
                        options: [
                            { value: 'id_asc', label: 'ID 升序' },
                            { value: 'id_desc', label: 'ID 降序' },
                            { value: 'name_asc', label: '名称 升序' },
                            { value: 'name_desc', label: '名称 降序' },
                            { value: 'begin_asc', label: '计划开始 升序' },
                            { value: 'begin_desc', label: '计划开始 降序' },
                            { value: 'end_asc', label: '计划结束 升序' },
                            { value: 'end_desc', label: '计划结束 降序' },
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
                name: 'create',
                display: '创建项目集',
                type: 'create',
                method: 'post',
                path: '/programs',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "项目集名称"
                            },
                            "begin": {
                                "type": "string",
                                "description": "计划开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "计划完成日期"
                            },
                            "PM": {
                                "type": "string",
                                "description": "计划完成日期"
                            },
                            "desc": {
                                "type": "string",
                                "description": "项目集描述"
                            }
                        },
                        "required": [
                            "name",
                            "begin",
                            "end"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取项目集详情',
                type: 'get',
                method: 'get',
                path: '/programs/{programID}',
                resultType: 'object',
                resultGetter: 'program',
                pathParams: {
                    programID: '项目集ID',
                },
            }, {
                name: 'update',
                display: '修改项目集',
                type: 'update',
                method: 'put',
                path: '/programs/{programID}',
                resultType: 'object',
                pathParams: {
                    programID: '项目集ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "项目集名称"
                            },
                            "begin": {
                                "type": "string",
                                "description": "计划开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "计划完成日期"
                            },
                            "PM": {
                                "type": "string",
                                "description": "计划完成日期"
                            },
                            "desc": {
                                "type": "string",
                                "description": "项目集描述"
                            }
                        },
                        "required": [
                            "name",
                            "begin",
                            "end"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除项目集',
                type: 'delete',
                method: 'delete',
                path: '/programs/{programID}',
                resultType: 'text',
                pathParams: {
                    programID: '项目集ID',
                },
                render: 'action',
            }
        ],
    },

    /* 产品模块 */
    {
        name: 'product',
        display: '产品',
        description: '产品管理，支持获取产品列表、创建产品、获取产品详情、修改产品、删除产品',
        actions: [
            {
                name: 'list',
                display: '获取产品列表',
                type: 'list',
                method: 'get',
                path: '/products',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'products',
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '浏览类型',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'noclosed', label: '未关闭' },
                            { value: 'closed', label: '已结束' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
                        options: [
                            { value: 'id_asc', label: 'ID 升序' },
                            { value: 'id_desc', label: 'ID 降序' },
                            { value: 'title_asc', label: '名称 升序' },
                            { value: 'title_desc', label: '名称 降序' },
                            { value: 'begin_asc', label: '计划开始 升序' },
                            { value: 'begin_desc', label: '计划开始 降序' },
                            { value: 'end_asc', label: '计划结束 升序' },
                            { value: 'end_desc', label: '计划结束 降序' },
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
                name: 'create',
                display: '创建产品',
                type: 'create',
                method: 'post',
                path: '/products',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "产品名称"
                            },
                            "program": {
                                "type": "integer",
                                "description": "所属项目集",
                                "format": "int32"
                            },
                            "line": {
                                "type": "integer",
                                "description": "所属产品线",
                                "format": "int32"
                            },
                            "type": {
                                "type": "string",
                                "description": "类型(normal 正常 | branch 多分支 | platform 多平台)"
                            },
                            "PO": {
                                "type": "string",
                                "description": "产品负责人"
                            },
                            "reviewer": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "评审人"
                            },
                            "desc": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "产品描述"
                            },
                            "QD": {
                                "type": "string",
                                "description": "测试负责人"
                            },
                            "RD": {
                                "type": "string",
                                "description": "发布负责人"
                            },
                            "acl": {
                                "type": "string",
                                "description": "访问控制(open 公开 | private 私有)"
                            }
                        },
                        "required": [
                            "name"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取产品详情',
                type: 'get',
                method: 'get',
                path: '/products/{productID}',
                resultType: 'object',
                resultGetter: 'product',
                pathParams: {
                    productID: '产品ID',
                },
            }, {
                name: 'update',
                display: '修改产品',
                type: 'update',
                method: 'put',
                path: '/products/{productID}',
                resultType: 'object',
                pathParams: {
                    productID: '产品ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "产品名称"
                            },
                            "program": {
                                "type": "integer",
                                "description": "所属项目集",
                                "format": "int32"
                            },
                            "line": {
                                "type": "integer",
                                "description": "所属产品线",
                                "format": "int32"
                            },
                            "type": {
                                "type": "string",
                                "description": "类型(normal 正常 | branch 多分支 | platform 多平台)"
                            },
                            "PO": {
                                "type": "string",
                                "description": "产品负责人"
                            },
                            "reviewer": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "评审人"
                            },
                            "desc": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "产品描述"
                            },
                            "QD": {
                                "type": "string",
                                "description": "测试负责人"
                            },
                            "RD": {
                                "type": "string",
                                "description": "发布负责人"
                            },
                            "acl": {
                                "type": "string",
                                "description": "访问控制(open 公开 | private 私有)"
                            }
                        },
                        "required": [
                            "name"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除产品',
                type: 'delete',
                method: 'delete',
                path: '/products/{productID}',
                resultType: 'text',
                pathParams: {
                    productID: '产品ID',
                },
                render: 'action',
            }
        ],
    },

    /* 项目模块 */
    {
        name: 'project',
        display: '项目',
        description: '项目管理，支持获取项目列表、创建项目、修改项目、删除项目',
        actions: [
            {
                name: 'list',
                display: '获取项目列表',
                type: 'list',
                method: 'get',
                path: '/projects',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'projects',
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '项目状态，默认是undone',
                        defaultValue: 'undone',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'undone', label: '未完成' },
                            { value: 'wait', label: '未开始' },
                            { value: 'doing', label: '进行中' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
                        options: [
                            { value: 'id_asc', label: 'ID 升序' },
                            { value: 'id_desc', label: 'ID 降序' },
                            { value: 'name_asc', label: '名称 升序' },
                            { value: 'name_desc', label: '名称 降序' },
                            { value: 'begin_asc', label: '计划开始 升序' },
                            { value: 'begin_desc', label: '计划开始 降序' },
                            { value: 'end_asc', label: '计划结束 升序' },
                            { value: 'end_desc', label: '计划结束 降序' },
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
                name: 'create',
                display: '创建项目',
                type: 'create',
                method: 'post',
                path: '/projects',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "项目名称"
                            },
                            "model": {
                                "type": "string",
                                "description": "项目管理方式(scrum 敏捷 | waterfall 瀑布 | kanban 看板 | agileplus 融合敏捷 | waterfallplus 融合瀑布)"
                            },
                            "begin": {
                                "type": "string",
                                "description": "开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "结束日期"
                            },
                            "products": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "关联产品"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "所属项目集",
                                "format": "int32"
                            },
                            "workflowGroup": {
                                "type": "integer",
                                "description": "项目流程，付费版功能，开源版可以不填",
                                "format": "int32"
                            },
                            "PM": {
                                "type": "string",
                                "description": "项目负责人"
                            }
                        },
                        "required": [
                            "name",
                            "model",
                            "begin",
                            "end",
                            "workflowGroup"
                        ]
                    },
                },
            }, {
                name: 'update',
                display: '修改项目',
                type: 'update',
                method: 'put',
                path: '/projects/{projectID}',
                resultType: 'object',
                pathParams: {
                    projectID: '项目ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "项目名称"
                            },
                            "model": {
                                "type": "string",
                                "description": "项目管理方式(scrum 敏捷 | waterfall 瀑布 | kanban 看板 | agileplus 融合敏捷 | waterfallplus 融合瀑布)"
                            },
                            "begin": {
                                "type": "string",
                                "description": "开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "结束日期"
                            },
                            "products": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "关联产品"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "所属项目集",
                                "format": "int32"
                            },
                            "workflowGroup": {
                                "type": "integer",
                                "description": "项目流程，付费版功能，开源版可以不填",
                                "format": "int32"
                            },
                            "PM": {
                                "type": "string",
                                "description": "项目负责人"
                            }
                        },
                        "required": [
                            "name",
                            "model",
                            "begin",
                            "end",
                            "workflowGroup"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除项目',
                type: 'delete',
                method: 'delete',
                path: '/projects/{projectID}',
                resultType: 'text',
                pathParams: {
                    projectID: '项目ID',
                },
                render: 'action',
            }
        ],
    },

    /* 执行模块 */
    {
        name: 'execution',
        display: '执行',
        description: '执行管理，支持获取执行列表、创建执行、获取执行详情、修改执行、删除执行',
        actions: [
            {
                name: 'list',
                display: '获取执行列表',
                type: 'list',
                method: 'get',
                path: '/executions',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'executions',
                params: [
                    {
                        name: 'status',
                        required: false,
                        type: 'string',
                        description: '执行状态，默认是undone',
                        defaultValue: 'undone',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'undone', label: '未完成' },
                            { value: 'wait', label: '未开始' },
                            { value: 'doing', label: '进行中' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
                        options: [
                            { value: 'rawID_asc', label: 'RAWID 升序' },
                            { value: 'rawID_desc', label: 'RAWID 降序' },
                            { value: 'nameCol_asc', label: '名称 升序' },
                            { value: 'nameCol_desc', label: '名称 降序' },
                            { value: 'begin_asc', label: '计划开始 升序' },
                            { value: 'begin_desc', label: '计划开始 降序' },
                            { value: 'end_asc', label: '计划结束 升序' },
                            { value: 'end_desc', label: '计划结束 降序' },
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
                name: 'create',
                display: '创建执行',
                type: 'create',
                method: 'post',
                path: '/executions',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "project": {
                                "type": "integer",
                                "description": "所属项目",
                                "format": "int32"
                            },
                            "name": {
                                "type": "string",
                                "description": "迭代名称"
                            },
                            "lifetime": {
                                "type": "string",
                                "description": "执行类型(short 短期 | long 长期 | ops 运维)"
                            },
                            "begin": {
                                "type": "string",
                                "description": "开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "结束日期"
                            },
                            "days": {
                                "type": "integer",
                                "description": "可用工作日",
                                "format": "int32"
                            },
                            "products": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "关联产品"
                            },
                            "plans": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "关联计划，必须是产品+planID的二维数组"
                            },
                            "PO": {
                                "type": "string",
                                "description": "产品负责人"
                            },
                            "QD": {
                                "type": "string",
                                "description": "测试负责人"
                            },
                            "PM": {
                                "type": "string",
                                "description": "执行负责人"
                            },
                            "RD": {
                                "type": "string",
                                "description": "发布负责人"
                            },
                            "acl": {
                                "type": "string",
                                "description": "访问控制(open 公开 | private 私有)"
                            }
                        },
                        "required": [
                            "project",
                            "name",
                            "begin",
                            "end",
                            "products"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取执行详情',
                type: 'get',
                method: 'get',
                path: '/executions/{executionID}',
                resultType: 'object',
                resultGetter: 'execution',
                pathParams: {
                    executionID: '执行ID',
                },
            }, {
                name: 'update',
                display: '修改执行',
                type: 'update',
                method: 'put',
                path: '/executions/{executionID}',
                resultType: 'object',
                pathParams: {
                    executionID: '执行ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "project": {
                                "type": "integer",
                                "description": "所属项目",
                                "format": "int32"
                            },
                            "name": {
                                "type": "string",
                                "description": "迭代名称"
                            },
                            "lifetime": {
                                "type": "string",
                                "description": "执行类型(short 短期 | long 长期 | ops 运维)"
                            },
                            "begin": {
                                "type": "string",
                                "description": "开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "结束日期"
                            },
                            "days": {
                                "type": "integer",
                                "description": "可用工作日",
                                "format": "int32"
                            },
                            "products": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "关联产品"
                            },
                            "plans": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "关联计划，必须是产品+planID的二维数组"
                            },
                            "PO": {
                                "type": "string",
                                "description": "产品负责人"
                            },
                            "QD": {
                                "type": "string",
                                "description": "测试负责人"
                            },
                            "PM": {
                                "type": "string",
                                "description": "执行负责人"
                            },
                            "RD": {
                                "type": "string",
                                "description": "发布负责人"
                            },
                            "acl": {
                                "type": "string",
                                "description": "访问控制(open 公开 | private 私有)"
                            }
                        },
                        "required": [
                            "name",
                            "begin",
                            "end"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除执行',
                type: 'delete',
                method: 'delete',
                path: '/executions/{executionID}',
                resultType: 'text',
                pathParams: {
                    executionID: '执行ID',
                },
                render: 'action',
            }
        ],
    },

    /* 产品计划模块 */
    {
        name: 'productplan',
        display: '产品计划',
        description: '产品计划管理，支持获取产品计划列表，支持获取产品下的产品计划、创建产品计划、获取产品计划详情、修改产品计划、删除产品计划',
        actions: [
            {
                name: 'list',
                display: '获取产品计划列表，支持获取产品下的产品计划',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/productplans',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'productplans',
                pathParams: {
                    scope: {description: '产品计划范围', options: [{value: 'products', label: '产品'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '执行状态，默认是undone',
                        defaultValue: 'undone',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'undone', label: '未完成' },
                            { value: 'wait', label: '未开始' },
                            { value: 'doing', label: '进行中' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
                        options: [
                            { value: 'id_asc', label: 'ID 升序' },
                            { value: 'id_desc', label: 'ID 降序' },
                            { value: 'title_asc', label: '名称 升序' },
                            { value: 'title_desc', label: '名称 降序' },
                            { value: 'begin_asc', label: '开始日期 升序' },
                            { value: 'begin_desc', label: '开始日期 降序' },
                            { value: 'end_asc', label: '结束日期 升序' },
                            { value: 'end_desc', label: '结束日期 降序' },
                            { value: 'status_asc', label: '状态 升序' },
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
                name: 'create',
                display: '创建产品计划',
                type: 'create',
                method: 'post',
                path: '/productplans',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "productID": {
                                "type": "integer",
                                "description": "产品ID",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string",
                                "description": "计划名称"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "父计划ID",
                                "format": "int32"
                            },
                            "begin": {
                                "type": "string",
                                "description": "开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "结束日期"
                            },
                            "branchID": {
                                "type": "integer",
                                "description": "分支ID",
                                "format": "int32"
                            },
                            "desc": {
                                "type": "string",
                                "description": "计划描述"
                            }
                        },
                        "required": [
                            "productID",
                            "title"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取产品计划详情',
                type: 'get',
                method: 'get',
                path: '/productplans/{planID}',
                resultType: 'object',
                resultGetter: 'productplan',
                pathParams: {
                    planID: '产品计划ID',
                },
            }, {
                name: 'update',
                display: '修改产品计划',
                type: 'update',
                method: 'put',
                path: '/productplans/{productplanID}',
                resultType: 'object',
                pathParams: {
                    productplanID: '产品计划ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "计划名称"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "父计划",
                                "format": "int32"
                            },
                            "begin": {
                                "type": "string",
                                "description": "开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "结束日期"
                            },
                            "branchID": {
                                "type": "integer",
                                "description": "分支ID",
                                "format": "int32"
                            },
                            "desc": {
                                "type": "string",
                                "description": "计划描述"
                            }
                        },
                        "required": [
                            "title"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除产品计划',
                type: 'delete',
                method: 'delete',
                path: '/productplans/{productplanID}',
                resultType: 'text',
                pathParams: {
                    productplanID: '产品计划ID',
                },
                render: 'action',
            }
        ],
    },

    /* 需求模块 */
    {
        name: 'story',
        display: '需求',
        description: '需求管理，支持获取需求列表，支持获取产品/项目/执行下的需求、创建需求、获取需求详情、修改需求、删除需求、激活需求、变更需求、关闭需求',
        actions: [
            {
                name: 'list',
                display: '获取需求列表，支持获取产品/项目/执行下的需求',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/stories',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'stories',
                pathParams: {
                    scope: {description: '需求范围', options: [{value: 'products', label: '产品'}, {value: 'projects', label: '项目'}, {value: 'executions', label: '执行'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '状态，默认是unclosed',
                        defaultValue: 'unclosed',
                        options: [
                            { value: 'allstory', label: '全部' },
                            { value: 'assignedtome', label: '指派给我' },
                            { value: 'openedbyme', label: '我创建' },
                            { value: 'reviewbyme', label: '待我评审' },
                            { value: 'draftstory', label: '草稿' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
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
                name: 'create',
                display: '创建需求',
                type: 'create',
                method: 'post',
                path: '/stories',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "productID": {
                                "type": "integer",
                                "description": "产品ID",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级，默认是3",
                                "format": "int32"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "父需求",
                                "format": "int32"
                            },
                            "estimate": {
                                "type": "number",
                                "description": "预计工时",
                                "format": "float"
                            },
                            "spec": {
                                "type": "string",
                                "description": "需求描述"
                            },
                            "category": {
                                "type": "integer",
                                "description": "类别(feature 功能 | interface 接口 | performance 性能 | safe 安全 | experience 体验 | improve 改进 | other 其他)",
                                "format": "int32"
                            },
                            "source": {
                                "type": "string",
                                "description": "来源(customer 客户 | user 用户 | po 产品经理 | market 市场 | service 客服 | operation 运营 | support 技术支持 | competitor 竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug | forum 论坛 | other 其他)"
                            },
                            "verify": {
                                "type": "string",
                                "description": "验收标准"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "reviewer": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "评审人，如果设置必须评审，必须填写"
                            },
                            "project": {
                                "type": "integer",
                                "description": "所属项目",
                                "format": "int32"
                            },
                            "execution": {
                                "type": "integer",
                                "description": "所属执行",
                                "format": "int32"
                            }
                        },
                        "required": [
                            "productID",
                            "title"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取需求详情',
                type: 'get',
                method: 'get',
                path: '/stories/{storyID}',
                resultType: 'object',
                resultGetter: 'story',
                pathParams: {
                    storyID: '需求ID',
                },
            }, {
                name: 'update',
                display: '修改需求',
                type: 'update',
                method: 'put',
                path: '/stories/{storyID}',
                resultType: 'object',
                pathParams: {
                    storyID: '需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级，默认是3",
                                "format": "int32"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "父需求",
                                "format": "int32"
                            },
                            "estimate": {
                                "type": "number",
                                "description": "预计工时",
                                "format": "float"
                            },
                            "category": {
                                "type": "integer",
                                "description": "类别(feature 功能 | interface 接口 | performance 性能 | safe 安全 | experience 体验 | improve 改进 | other 其他)",
                                "format": "int32"
                            },
                            "source": {
                                "type": "string",
                                "description": "来源(customer 客户 | user 用户 | po 产品经理 | market 市场 | service 客服 | operation 运营 | support 技术支持 | competitor 竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug | forum 论坛 | other 其他)"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            }
                        },
                        "required": [
                            "title"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除需求',
                type: 'delete',
                method: 'delete',
                path: '/stories/{storyID}',
                resultType: 'text',
                pathParams: {
                    storyID: '需求ID',
                },
                render: 'action',
            }, {
                name: 'activate',
                display: '激活需求',
                type: 'action',
                method: 'put',
                path: '/stories/{storyID}/activate',
                resultType: 'text',
                pathParams: {
                    storyID: '需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        }
                    },
                },
                render: 'action',
            }, {
                name: 'change',
                display: '变更需求',
                type: 'action',
                method: 'put',
                path: '/stories/{storyID}/change',
                resultType: 'text',
                pathParams: {
                    storyID: '需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "需求名称"
                            },
                            "reviewer": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "评审人员"
                            },
                            "spec": {
                                "type": "string",
                                "description": "需求描述"
                            },
                            "verify": {
                                "type": "string",
                                "description": "验收标准"
                            }
                        },
                        "required": [
                            "reviewer"
                        ]
                    },
                },
                render: 'action',
            }, {
                name: 'close',
                display: '关闭需求',
                type: 'action',
                method: 'put',
                path: '/stories/{storyID}/close',
                resultType: 'text',
                pathParams: {
                    storyID: '需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "closedReason": {
                                "type": "string",
                                "description": "关闭原因(done 已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 | willnotdo 不做 | cancel 已取消 | bydesign 设计如此)"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        },
                        "required": [
                            "closedReason"
                        ]
                    },
                },
                render: 'action',
            }
        ],
    },

    /* 业务需求模块 */
    {
        name: 'epic',
        display: '业务需求',
        description: '业务需求管理，支持获取业务需求列表，支持获取产品下的业务需求、创建业务需求、获取业务需求详情、修改业务需求、删除业务需求、激活业务需求、变更业务需求、关闭业务需求',
        actions: [
            {
                name: 'list',
                display: '获取业务需求列表，支持获取产品下的业务需求',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/epics',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'epics',
                pathParams: {
                    scope: {description: '业务需求范围', options: [{value: 'products', label: '产品'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '状态，默认是unclosed',
                        defaultValue: 'unclosed',
                        options: [
                            { value: 'allstory', label: '全部' },
                            { value: 'assignedtome', label: '指派给我' },
                            { value: 'openedbyme', label: '我创建' },
                            { value: 'reviewbyme', label: '待我评审' },
                            { value: 'draftstory', label: '草稿' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
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
                name: 'create',
                display: '创建业务需求',
                type: 'create',
                method: 'post',
                path: '/epics',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "productID": {
                                "type": "integer",
                                "description": "产品ID",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级，默认是3",
                                "format": "int32"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "父业务需求",
                                "format": "int32"
                            },
                            "estimate": {
                                "type": "number",
                                "description": "预计工时",
                                "format": "float"
                            },
                            "spec": {
                                "type": "string",
                                "description": "业务需求描述"
                            },
                            "category": {
                                "type": "integer",
                                "description": "类别(feature 功能 | interface 接口 | performance 性能 | safe 安全 | experience 体验 | improve 改进 | other 其他)",
                                "format": "int32"
                            },
                            "source": {
                                "type": "string",
                                "description": "来源(customer 客户 | user 用户 | po 产品经理 | market 市场 | service 客服 | operation 运营 | support 技术支持 | competitor 竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug | forum 论坛 | other 其他)"
                            },
                            "verify": {
                                "type": "string",
                                "description": "验收标准"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "reviewer": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "评审人，如果设置必须评审，必须填写"
                            }
                        },
                        "required": [
                            "productID",
                            "title"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取业务需求详情',
                type: 'get',
                method: 'get',
                path: '/epics/{storyID}',
                resultType: 'object',
                resultGetter: 'epic',
                pathParams: {
                    storyID: '需求ID',
                },
            }, {
                name: 'update',
                display: '修改业务需求',
                type: 'update',
                method: 'put',
                path: '/epics/{epicID}',
                resultType: 'object',
                pathParams: {
                    epicID: '业务需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "需求名称"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级，默认是3",
                                "format": "int32"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "父业务需求",
                                "format": "int32"
                            },
                            "estimate": {
                                "type": "number",
                                "description": "预计工时",
                                "format": "float"
                            },
                            "category": {
                                "type": "integer",
                                "description": "类别(feature 功能 | interface 接口 | performance 性能 | safe 安全 | experience 体验 | improve 改进 | other 其他)",
                                "format": "int32"
                            },
                            "source": {
                                "type": "string",
                                "description": "来源(customer 客户 | user 用户 | po 产品经理 | market 市场 | service 客服 | operation 运营 | support 技术支持 | competitor 竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug | forum 论坛 | other 其他)"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            }
                        },
                        "required": [
                            "title"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除业务需求',
                type: 'delete',
                method: 'delete',
                path: '/epics/{epicID}',
                resultType: 'text',
                pathParams: {
                    epicID: '业务需求ID',
                },
                render: 'action',
            }, {
                name: 'activate',
                display: '激活业务需求',
                type: 'action',
                method: 'put',
                path: '/epics/{epicID}/activate',
                resultType: 'text',
                pathParams: {
                    epicID: '业务需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        }
                    },
                },
                render: 'action',
            }, {
                name: 'change',
                display: '变更业务需求',
                type: 'action',
                method: 'put',
                path: '/epics/{epicID}/change',
                resultType: 'text',
                pathParams: {
                    epicID: '业务需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "需求名称"
                            },
                            "reviewer": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "评审人员"
                            },
                            "spec": {
                                "type": "string",
                                "description": "需求描述"
                            },
                            "verify": {
                                "type": "string",
                                "description": "验收标准"
                            }
                        },
                        "required": [
                            "reviewer"
                        ]
                    },
                },
                render: 'action',
            }, {
                name: 'close',
                display: '关闭业务需求',
                type: 'action',
                method: 'put',
                path: '/epics/{epicID}/close',
                resultType: 'text',
                pathParams: {
                    epicID: '业务需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "closedReason": {
                                "type": "string",
                                "description": "关闭原因(done 已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 | willnotdo 不做 | cancel 已取消 | bydesign 设计如此)"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        },
                        "required": [
                            "closedReason"
                        ]
                    },
                },
                render: 'action',
            }
        ],
    },

    /* 用户需求模块 */
    {
        name: 'requirement',
        display: '用户需求',
        description: '用户需求管理，支持获取用户需求列表，支持获取产品下的用户需求、创建用户需求、获取用户需求详情、修改用户需求、删除用户需求、激活用户需求、变更用户需求、关闭用户需求',
        actions: [
            {
                name: 'list',
                display: '获取用户需求列表，支持获取产品下的用户需求',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/requirements',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'requirements',
                pathParams: {
                    scope: {description: '用户需求范围', options: [{value: 'products', label: '产品'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '状态，默认是unclosed',
                        defaultValue: 'unclosed',
                        options: [
                            { value: 'allstory', label: '全部' },
                            { value: 'assignedtome', label: '指派给我' },
                            { value: 'openedbyme', label: '我创建' },
                            { value: 'reviewbyme', label: '待我评审' },
                            { value: 'draftstory', label: '草稿' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
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
                name: 'create',
                display: '创建用户需求',
                type: 'create',
                method: 'post',
                path: '/requirements',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "productID": {
                                "type": "integer",
                                "description": "产品ID",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级，默认是3",
                                "format": "int32"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "父用户需求",
                                "format": "int32"
                            },
                            "estimate": {
                                "type": "number",
                                "description": "预计工时",
                                "format": "float"
                            },
                            "spec": {
                                "type": "string",
                                "description": "用户需求描述"
                            },
                            "category": {
                                "type": "integer",
                                "description": "类别(feature 功能 | interface 接口 | performance 性能 | safe 安全 | experience 体验 | improve 改进 | other 其他)",
                                "format": "int32"
                            },
                            "source": {
                                "type": "string",
                                "description": "来源(customer 客户 | user 用户 | po 产品经理 | market 市场 | service 客服 | operation 运营 | support 技术支持 | competitor 竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug | forum 论坛 | other 其他)"
                            },
                            "verify": {
                                "type": "string",
                                "description": "验收标准"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "reviewer": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "评审人，如果设置必须评审，必须填写"
                            }
                        },
                        "required": [
                            "productID",
                            "title"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取用户需求详情',
                type: 'get',
                method: 'get',
                path: '/requirements/{storyID}',
                resultType: 'object',
                resultGetter: 'requirement',
                pathParams: {
                    storyID: '需求ID',
                },
            }, {
                name: 'update',
                display: '修改用户需求',
                type: 'update',
                method: 'put',
                path: '/requirements/{requirementID}',
                resultType: 'object',
                pathParams: {
                    requirementID: '用户需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级，默认是3",
                                "format": "int32"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "parent": {
                                "type": "integer",
                                "description": "父用户需求",
                                "format": "int32"
                            },
                            "estimate": {
                                "type": "number",
                                "description": "预计工时",
                                "format": "float"
                            },
                            "category": {
                                "type": "integer",
                                "description": "类别(feature 功能 | interface 接口 | performance 性能 | safe 安全 | experience 体验 | improve 改进 | other 其他)",
                                "format": "int32"
                            },
                            "source": {
                                "type": "string",
                                "description": "来源(customer 客户 | user 用户 | po 产品经理 | market 市场 | service 客服 | operation 运营 | support 技术支持 | competitor 竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug | forum 论坛 | other 其他)"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            }
                        },
                        "required": [
                            "title"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除用户需求',
                type: 'delete',
                method: 'delete',
                path: '/requirements/{requirementID}',
                resultType: 'text',
                pathParams: {
                    requirementID: '用户需求ID',
                },
                render: 'action',
            }, {
                name: 'activate',
                display: '激活用户需求',
                type: 'action',
                method: 'put',
                path: '/requirements/{requirementID}/activate',
                resultType: 'text',
                pathParams: {
                    requirementID: '用户需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        }
                    },
                },
                render: 'action',
            }, {
                name: 'change',
                display: '变更用户需求',
                type: 'action',
                method: 'put',
                path: '/requirements/{requirementID}/change',
                resultType: 'text',
                pathParams: {
                    requirementID: '用户需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "需求名称"
                            },
                            "spec": {
                                "type": "string",
                                "description": "需求描述"
                            },
                            "verify": {
                                "type": "string",
                                "description": "验收标准"
                            }
                        }
                    },
                },
                render: 'action',
            }, {
                name: 'close',
                display: '关闭用户需求',
                type: 'action',
                method: 'put',
                path: '/requirements/{requirementID}/close',
                resultType: 'text',
                pathParams: {
                    requirementID: '用户需求ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "closedReason": {
                                "type": "string",
                                "description": "关闭原因(done 已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 | willnotdo 不做 | cancel 已取消 | bydesign 设计如此)"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        },
                        "required": [
                            "closedReason"
                        ]
                    },
                },
                render: 'action',
            }
        ],
    },

    /* Bug模块 */
    {
        name: 'bug',
        display: 'Bug',
        description: 'Bug管理，支持获取Bug列表，支持获取产品/项目/执行下的Bug、创建Bug、获取Bug详情、修改Bug、删除Bug、激活Bug、关闭Bug、解决Bug',
        actions: [
            {
                name: 'list',
                display: '获取Bug列表，支持获取产品/项目/执行下的Bug',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/bugs',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'bugs',
                pathParams: {
                    scope: {description: 'Bug范围', options: [{value: 'products', label: '产品'}, {value: 'projects', label: '项目'}, {value: 'executions', label: '执行'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '状态，默认是unclosed',
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
                        "type": "object",
                        "properties": {
                            "productID": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string",
                                "description": "Bug标题"
                            },
                            "openedBuild": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "影响版本,主干是trunk，其他版本使用版本ID"
                            },
                            "project": {
                                "type": "integer",
                                "description": "所属项目",
                                "format": "int32"
                            },
                            "execution": {
                                "type": "integer",
                                "description": "所属执行",
                                "format": "int32"
                            },
                            "severity": {
                                "type": "integer",
                                "description": "严重程度，默认是3",
                                "format": "int32"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级，默认是3",
                                "format": "int32"
                            },
                            "type": {
                                "type": "string",
                                "description": "Bug类型(codeerror 代码错误 | config 配置相关 | install 安装部署 | security 安全相关 | performance 性能问题 | standard 标准规范 | automation 测试脚本 | designdefect 设计缺陷 | others 其他)"
                            },
                            "steps": {
                                "type": "string",
                                "description": "重现步骤"
                            },
                            "story": {
                                "type": "integer",
                                "description": "相关需求",
                                "format": "int32"
                            }
                        },
                        "required": [
                            "productID",
                            "title",
                            "openedBuild"
                        ]
                    },
                },
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
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "Bug标题"
                            },
                            "severity": {
                                "type": "integer",
                                "description": "严重程度，默认是3",
                                "format": "int32"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级，默认是3",
                                "format": "int32"
                            },
                            "type": {
                                "type": "string",
                                "description": "Bug类型(codeerror 代码错误 | config 配置相关 | install 安装部署 | security 安全相关 | performance 性能问题 | standard 标准规范 | automation 测试脚本 | designdefect 设计缺陷 | others 其他)"
                            },
                            "openedBuild": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "影响版本,主干是trunk，其他版本使用版本ID"
                            },
                            "steps": {
                                "type": "string",
                                "description": "重现步骤"
                            },
                            "project": {
                                "type": "integer",
                                "description": "所属项目",
                                "format": "int32"
                            },
                            "execution": {
                                "type": "integer",
                                "description": "所属执行",
                                "format": "int32"
                            },
                            "story": {
                                "type": "integer",
                                "description": "相关需求",
                                "format": "int32"
                            }
                        }
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
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "openedBuild": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "影响版本, trunk为主干"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        }
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
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        }
                    },
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
                        "type": "object",
                        "properties": {
                            "resolution": {
                                "type": "string",
                                "description": "fixed 已解决 | notrepro 无法重现 | bydesign 设计如此 | duplicate 重复Bug | external 外部原因| postponed 延期处理 | willnotfix 不予解决 | tostory 转为需求"
                            },
                            "resolvedDate": {
                                "type": "string",
                                "description": "解决日期，默认今天"
                            },
                            "resolvedBuild": {
                                "type": "string",
                                "description": "解决版本, trunk为主干"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        },
                        "required": [
                            "resolution"
                        ]
                    },
                },
                render: 'action',
            }
        ],
    },

    /* 测试用例模块 */
    {
        name: 'testcase',
        display: '测试用例',
        description: '测试用例管理，支持获取测试用例列表，支持获取产品/项目/执行下的测试用例、创建测试用例、获取测试用例详情、修改测试用例、删除测试用例',
        actions: [
            {
                name: 'list',
                display: '获取测试用例列表，支持获取产品/项目/执行下的测试用例',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/testcases',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'testcases',
                pathParams: {
                    scope: {description: '测试用例范围', options: [{value: 'products', label: '产品'}, {value: 'projects', label: '项目'}, {value: 'executions', label: '执行'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '状态，默认是all',
                        defaultValue: 'all',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'wait', label: '未关闭' },
                            { value: 'needconfirm', label: '需求变动' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
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
                name: 'create',
                display: '创建测试用例',
                type: 'create',
                method: 'post',
                path: '/testcases',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "productID": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string",
                                "description": "用例标题"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "story": {
                                "type": "integer",
                                "description": "相关需求",
                                "format": "int32"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级",
                                "format": "int32"
                            },
                            "type": {
                                "type": "string",
                                "description": "用例类型(unit 单元测试 | interface 接口测试 | feature 功能测试 | install 安装部署 | config 配置相关 | performance 性能测试 | security 安全相关 | other 其他)"
                            },
                            "precondition": {
                                "type": "string",
                                "description": "前置条件"
                            },
                            "steps": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "用例步骤"
                            },
                            "expects": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "用例步骤期望"
                            },
                            "stepType": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "用例步骤类型(step 步骤 | group 父级步骤)"
                            },
                            "project": {
                                "type": "integer",
                                "description": "所属项目",
                                "format": "int32"
                            },
                            "execution": {
                                "type": "integer",
                                "description": "所属执行",
                                "format": "int32"
                            }
                        },
                        "required": [
                            "productID",
                            "title"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取测试用例详情',
                type: 'get',
                method: 'get',
                path: '/testcases/{caseID}',
                resultType: 'object',
                resultGetter: 'testcase',
                pathParams: {
                    caseID: '测试用例ID',
                },
            }, {
                name: 'update',
                display: '修改测试用例',
                type: 'update',
                method: 'put',
                path: '/testcases/{testcasID}',
                resultType: 'object',
                pathParams: {
                    testcasID: '测试用例ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "用例标题"
                            },
                            "moudule": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "story": {
                                "type": "integer",
                                "description": "相关需求",
                                "format": "int32"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级",
                                "format": "int32"
                            },
                            "type": {
                                "type": "string",
                                "description": "用例类型(unit 单元测试 | interface 接口测试 | feature 功能测试 | install 安装部署 | config 配置相关 | performance 性能测试 | security 安全相关 | other 其他)"
                            },
                            "precondition": {
                                "type": "string",
                                "description": "前置条件"
                            },
                            "steps": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "用例步骤"
                            },
                            "expects": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "用例步骤期望"
                            },
                            "stepType": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "用例步骤类型(step 步骤 | group 父级步骤)"
                            }
                        },
                        "required": [
                            "title"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除测试用例',
                type: 'delete',
                method: 'delete',
                path: '/testcases/{testcasID}',
                resultType: 'text',
                pathParams: {
                    testcasID: '测试用例ID',
                },
                render: 'action',
            }
        ],
    },

    /* 任务模块 */
    {
        name: 'task',
        display: '任务',
        description: '任务管理，支持获取任务列表，支持获取执行下的任务、创建任务、获取任务详情、修改任务、删除任务、激活任务、关闭任务、完成任务、启动任务',
        actions: [
            {
                name: 'list',
                display: '获取任务列表，支持获取执行下的任务',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/tasks',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'tasks',
                pathParams: {
                    scope: {description: '任务范围', options: [{value: 'executions', label: '执行'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'status',
                        required: false,
                        type: 'string',
                        description: '状态，默认是unclosed',
                        defaultValue: 'unclosed',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'unclosed', label: '未关闭' },
                            { value: 'assignedtome', label: '指派给我' },
                            { value: 'assignedtome', label: '指派给我' },
                            { value: 'myinvolved', label: '由我参与' },
                            { value: 'assignedbyme', label: '由我指派' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
                        options: [
                            { value: 'id_asc', label: 'ID 升序' },
                            { value: 'id_desc', label: 'ID 降序' },
                            { value: 'name_asc', label: '名称 升序' },
                            { value: 'name_desc', label: '名称 降序' },
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
                name: 'create',
                display: '创建任务',
                type: 'create',
                method: 'post',
                path: '/tasks',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "任务名称"
                            },
                            "executionID": {
                                "type": "integer",
                                "description": "所属执行",
                                "format": "int32"
                            },
                            "type": {
                                "type": "string",
                                "description": "任务类型"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "estStarted": {
                                "type": "string",
                                "description": "预计开始"
                            },
                            "deadline": {
                                "type": "string",
                                "description": "截止日期"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级",
                                "format": "int32"
                            },
                            "estimate": {
                                "type": "number",
                                "description": "预计工时",
                                "format": "float"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "story": {
                                "type": "integer",
                                "description": "相关需求",
                                "format": "int32"
                            },
                            "desc": {
                                "type": "string",
                                "description": "任务描述"
                            }
                        },
                        "required": [
                            "name",
                            "executionID"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取任务详情',
                type: 'get',
                method: 'get',
                path: '/tasks/{taskID}',
                resultType: 'object',
                pathParams: {
                    taskID: '任务ID',
                },
            }, {
                name: 'update',
                display: '修改任务',
                type: 'update',
                method: 'put',
                path: '/tasks/{taskID}',
                resultType: 'object',
                pathParams: {
                    taskID: '任务ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "任务名称"
                            },
                            "type": {
                                "type": "string",
                                "description": "任务类型"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "estStarted": {
                                "type": "string",
                                "description": "预计开始"
                            },
                            "deadline": {
                                "type": "string",
                                "description": "截止日期"
                            },
                            "pri": {
                                "type": "integer",
                                "description": "优先级",
                                "format": "int32"
                            },
                            "estimate": {
                                "type": "number",
                                "description": "预计工时",
                                "format": "float"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "story": {
                                "type": "integer",
                                "description": "相关需求",
                                "format": "int32"
                            },
                            "desc": {
                                "type": "string",
                                "description": "任务描述"
                            }
                        }
                    },
                },
            }, {
                name: 'delete',
                display: '删除任务',
                type: 'delete',
                method: 'delete',
                path: '/tasks/{taskID}',
                resultType: 'text',
                pathParams: {
                    taskID: '任务ID',
                },
                render: 'action',
            }, {
                name: 'activate',
                display: '激活任务',
                type: 'action',
                method: 'put',
                path: '/tasks/{taskID}/activate',
                resultType: 'text',
                pathParams: {
                    taskID: '任务ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "left": {
                                "type": "number",
                                "description": "预计剩余",
                                "format": "float"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        }
                    },
                },
                render: 'action',
            }, {
                name: 'close',
                display: '关闭任务',
                type: 'action',
                method: 'put',
                path: '/tasks/{taskID}/close',
                resultType: 'text',
                pathParams: {
                    taskID: '任务ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        }
                    },
                },
                render: 'action',
            }, {
                name: 'finish',
                display: '完成任务',
                type: 'action',
                method: 'put',
                path: '/tasks/{taskID}/finish',
                resultType: 'text',
                pathParams: {
                    taskID: '任务ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "currentConsumed": {
                                "type": "number",
                                "description": "本次消耗",
                                "format": "float"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "任务名称"
                            },
                            "consumed": {
                                "type": "number",
                                "description": "总计消耗",
                                "format": "float"
                            },
                            "realStarted": {
                                "type": "string",
                                "description": "实际开始"
                            },
                            "finishedDate": {
                                "type": "string",
                                "description": "实际完成"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        },
                        "required": [
                            "currentConsumed",
                            "realStarted",
                            "finishedDate"
                        ]
                    },
                },
                render: 'action',
            }, {
                name: 'start',
                display: '启动任务',
                type: 'action',
                method: 'put',
                path: '/tasks/{taskID}/start',
                resultType: 'text',
                pathParams: {
                    taskID: '任务ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "assignedTo": {
                                "type": "string",
                                "description": "任务名称"
                            },
                            "realStarted": {
                                "type": "string",
                                "description": "实际开始"
                            },
                            "consumed": {
                                "type": "number",
                                "description": "总计消耗",
                                "format": "float"
                            },
                            "left": {
                                "type": "number",
                                "description": "预计剩余",
                                "format": "float"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        },
                        "required": [
                            "realStarted"
                        ]
                    },
                },
                render: 'action',
            }
        ],
    },

    /* 反馈模块 */
    {
        name: 'feedback',
        display: '反馈',
        description: '反馈管理，支持获取反馈列表，支持获取产品下的反馈、创建反馈、获取反馈详情、修改反馈、删除反馈、激活反馈、关闭反馈',
        actions: [
            {
                name: 'list',
                display: '获取反馈列表，支持获取产品下的反馈',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/feedbacks',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'feedbacks',
                pathParams: {
                    scope: {description: '反馈范围', options: [{value: 'products', label: '产品'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '状态，默认是wait',
                        defaultValue: 'wait',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'wait', label: '待处理' },
                            { value: 'doing', label: '处理中' },
                            { value: 'toclosed', label: '待关闭' },
                            { value: 'review', label: '待评审' },
                            { value: 'assigntome', label: '指派给我' },
                            { value: 'openedbyme', label: '由我反馈' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
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
                name: 'create',
                display: '创建反馈',
                type: 'create',
                method: 'post',
                path: '/feedbacks',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "product": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string",
                                "description": "标题"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "type": {
                                "type": "string",
                                "description": "类型(story 需求 | task 任务 | bug Bug | todo 待办 | advice 建议 | issue 问题 | risk 风险 | opportunity 机会)"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            },
                            "feedbackBy": {
                                "type": "string",
                                "description": "反馈者"
                            },
                            "source": {
                                "type": "string",
                                "description": "来源"
                            }
                        },
                        "required": [
                            "product",
                            "title"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取反馈详情',
                type: 'get',
                method: 'get',
                path: '/feedbacks/{feedbackID}',
                resultType: 'object',
                resultGetter: 'feedback',
                pathParams: {
                    feedbackID: '反馈ID',
                },
            }, {
                name: 'update',
                display: '修改反馈',
                type: 'update',
                method: 'put',
                path: '/feedbacks/{feedbackID}',
                resultType: 'object',
                pathParams: {
                    feedbackID: '反馈ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "product": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string",
                                "description": "标题"
                            },
                            "type": {
                                "type": "string",
                                "description": "类型(story 需求 | task 任务 | bug Bug | todo 待办 | advice 建议 | issue 问题 | risk 风险 | opportunity 机会)"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            },
                            "feedbackBy": {
                                "type": "string",
                                "description": "反馈者"
                            },
                            "source": {
                                "type": "string",
                                "description": "来源"
                            }
                        },
                        "required": [
                            "product",
                            "title"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除反馈',
                type: 'delete',
                method: 'delete',
                path: '/feedbacks/{feedbackID}',
                resultType: 'text',
                pathParams: {
                    feedbackID: '反馈ID',
                },
                render: 'action',
            }, {
                name: 'activate',
                display: '激活反馈',
                type: 'action',
                method: 'put',
                path: '/feedbacks/{feedbackID}/activate',
                resultType: 'text',
                pathParams: {
                    feedbackID: '反馈ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        }
                    },
                },
                render: 'action',
            }, {
                name: 'close',
                display: '关闭反馈',
                type: 'action',
                method: 'put',
                path: '/feedbacks/{feedbackID}/close',
                resultType: 'text',
                pathParams: {
                    feedbackID: '反馈ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "closedReason": {
                                "type": "string",
                                "description": "关闭原因(commented 已处理 | repeat 重复 | refuse 不予采纳)"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        },
                        "required": [
                            "closedReason"
                        ]
                    },
                },
                render: 'action',
            }
        ],
    },

    /* 工单模块 */
    {
        name: 'ticket',
        display: '工单',
        description: '工单管理，支持获取工单列表，支持获取产品下的工单、创建工单、获取工单详情、修改工单、删除工单、激活工单、关闭工单',
        actions: [
            {
                name: 'list',
                display: '获取工单列表，支持获取产品下的工单',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/tickets',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'tickets',
                pathParams: {
                    scope: {description: '工单范围', options: [{value: 'products', label: '产品'}]},
                    scopeID: '范围ID',
                },
                params: [
                    {
                        name: 'browseType',
                        required: false,
                        type: 'string',
                        description: '状态，默认是wait',
                        defaultValue: 'wait',
                        options: [
                            { value: 'all', label: '全部' },
                            { value: 'unclosed', label: '未关闭' },
                            { value: 'wait', label: '待处理' },
                            { value: 'doing', label: '处理中' },
                            { value: 'done', label: '待关闭' },
                            { value: 'finishedbyme', label: '由我解决' },
                            { value: 'assigntome', label: '指派给我' },
                            { value: 'openedbyme', label: '由我创建' },
                        ],
                    },
                    {
                        name: 'orderBy',
                        required: false,
                        type: 'string',
                        description: '排序',
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
                name: 'create',
                display: '创建工单',
                type: 'create',
                method: 'post',
                path: '/tickets',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "product": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string",
                                "description": "标题"
                            },
                            "type": {
                                "type": "string",
                                "description": "类型(code 程序报错 | data 数据错误 | stuck 流程卡断 | security 安全问题 | affair 事务)"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "deadline": {
                                "type": "string",
                                "description": "截止日期"
                            },
                            "openedBuild": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "影响版本"
                            }
                        },
                        "required": [
                            "product",
                            "title"
                        ]
                    },
                },
            }, {
                name: 'get',
                display: '获取工单详情',
                type: 'get',
                method: 'get',
                path: '/tickets/{ticketID}',
                resultType: 'object',
                resultGetter: 'ticket',
                pathParams: {
                    ticketID: '工单ID',
                },
            }, {
                name: 'update',
                display: '修改工单',
                type: 'update',
                method: 'put',
                path: '/tickets/{ticketID}',
                resultType: 'object',
                pathParams: {
                    ticketID: '工单ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "product": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "module": {
                                "type": "integer",
                                "description": "所属模块",
                                "format": "int32"
                            },
                            "title": {
                                "type": "string",
                                "description": "标题"
                            },
                            "type": {
                                "type": "string",
                                "description": "类型(code 程序报错 | data 数据错误 | stuck 流程卡断 | security 安全问题 | affair 事务)"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            },
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "deadline": {
                                "type": "string",
                                "description": "截止日期"
                            },
                            "openedBuild": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "影响版本"
                            }
                        }
                    },
                },
            }, {
                name: 'delete',
                display: '删除工单',
                type: 'delete',
                method: 'delete',
                path: '/tickets/{ticketID}',
                resultType: 'text',
                pathParams: {
                    ticketID: '工单ID',
                },
                render: 'action',
            }, {
                name: 'activate',
                display: '激活工单',
                type: 'action',
                method: 'put',
                path: '/tickets/{ticketID}/activate',
                resultType: 'text',
                pathParams: {
                    ticketID: '工单ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "assignedTo": {
                                "type": "string",
                                "description": "指派给"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        }
                    },
                },
                render: 'action',
            }, {
                name: 'close',
                display: '关闭工单',
                type: 'action',
                method: 'put',
                path: '/tickets/{ticketID}/close',
                resultType: 'text',
                pathParams: {
                    ticketID: '工单ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "closedReason": {
                                "type": "string",
                                "description": "关闭原因(commented 已处理 | repeat 重复 | refuse 不予处理)"
                            },
                            "comment": {
                                "type": "string",
                                "description": "备注"
                            }
                        },
                        "required": [
                            "closedReason",
                            "comment"
                        ]
                    },
                },
                render: 'action',
            }
        ],
    },

    /* 应用模块 */
    {
        name: 'system',
        display: '应用',
        description: '应用管理，支持获取应用列表，支持获取产品下的应用、创建应用、修改应用',
        actions: [
            {
                name: 'list',
                display: '获取应用列表，支持获取产品下的应用',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/systems',
                resultType: 'list',
                pagerGetter: 'pager',
                pathParams: {
                    scope: {description: '应用范围', options: [{value: 'products', label: '产品'}]},
                    scopeID: '范围ID',
                },
            }, {
                name: 'create',
                display: '创建应用',
                type: 'create',
                method: 'post',
                path: '/systems',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "productID": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "integrated": {
                                "type": "integer",
                                "description": "是否集成应用(0 否| 1 是)",
                                "format": "int32"
                            },
                            "children": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "集成应用需要包含其他应用，非集成应用传空数组[]"
                            },
                            "name": {
                                "type": "string",
                                "description": "应用名称"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            }
                        },
                        "required": [
                            "productID",
                            "integrated",
                            "children",
                            "name"
                        ]
                    },
                },
            }, {
                name: 'update',
                display: '修改应用',
                type: 'update',
                method: 'put',
                path: '/systems/{systemID}',
                resultType: 'object',
                pathParams: {
                    systemID: '应用ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "应用名称"
                            },
                            "children": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "集成应用需要包含其他应用，非集成应用传空数组[]"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            }
                        },
                        "required": [
                            "name",
                            "children"
                        ]
                    },
                },
            }
        ],
    },

    /* 版本模块 */
    {
        name: 'build',
        display: '版本',
        description: '版本管理，支持获取版本列表，支持获取项目/执行下的版本、创建版本/构建、修改版本、删除版本',
        actions: [
            {
                name: 'list',
                display: '获取版本列表，支持获取项目/执行下的版本',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/builds',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'builds',
                pathParams: {
                    scope: {description: '版本范围', options: [{value: 'projects', label: '项目'}, {value: 'executions', label: '执行'}]},
                    scopeID: '范围ID',
                },
            }, {
                name: 'create',
                display: '创建版本/构建',
                type: 'create',
                method: 'post',
                path: '/builds',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "executionID": {
                                "type": "integer",
                                "description": "所属执行/迭代",
                                "format": "int32"
                            },
                            "product": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "name": {
                                "type": "string",
                                "description": "构建名称"
                            },
                            "system": {
                                "type": "integer",
                                "description": "所属应用",
                                "format": "int32"
                            },
                            "builder": {
                                "type": "string",
                                "description": "构建者"
                            },
                            "date": {
                                "type": "string",
                                "description": "打包日期"
                            },
                            "scmPath": {
                                "type": "string",
                                "description": "源代码地址"
                            },
                            "filePath": {
                                "type": "string",
                                "description": "下载地址"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            }
                        },
                        "required": [
                            "executionID",
                            "product",
                            "name",
                            "system",
                            "builder",
                            "date"
                        ]
                    },
                },
            }, {
                name: 'update',
                display: '修改版本',
                type: 'update',
                method: 'put',
                path: '/builds/{buildID}',
                resultType: 'object',
                pathParams: {
                    buildID: '版本ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "execution": {
                                "type": "integer",
                                "description": "所属执行/迭代",
                                "format": "int32"
                            },
                            "product": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "name": {
                                "type": "string",
                                "description": "构建名称"
                            },
                            "system": {
                                "type": "integer",
                                "description": "所属应用",
                                "format": "int32"
                            },
                            "builder": {
                                "type": "string",
                                "description": "构建者"
                            },
                            "date": {
                                "type": "string",
                                "description": "打包日期"
                            },
                            "scmPath": {
                                "type": "string",
                                "description": "源代码地址"
                            },
                            "filePath": {
                                "type": "string",
                                "description": "下载地址"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            }
                        },
                        "required": [
                            "execution",
                            "product",
                            "name",
                            "system",
                            "builder",
                            "date"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除版本',
                type: 'delete',
                method: 'delete',
                path: '/builds/{buildID}',
                resultType: 'text',
                pathParams: {
                    buildID: '版本ID',
                },
                render: 'action',
            }
        ],
    },

    /* 测试单模块 */
    {
        name: 'testtask',
        display: '测试单',
        description: '测试单管理，支持获取测试单列表，支持获取产品/项目/执行下的测试单、创建测试单、修改测试单、删除测试单',
        actions: [
            {
                name: 'list',
                display: '获取测试单列表，支持获取产品/项目/执行下的测试单',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/testtasks',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'testtasks',
                pathParams: {
                    scope: {description: '测试单范围', options: [{value: 'products', label: '产品'}, {value: 'projects', label: '项目'}, {value: 'executions', label: '执行'}]},
                    scopeID: '范围ID',
                },
            }, {
                name: 'create',
                display: '创建测试单',
                type: 'create',
                method: 'post',
                path: '/testtasks',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "productID": {
                                "type": "integer",
                                "description": "所属产品ID",
                                "format": "int32"
                            },
                            "name": {
                                "type": "string",
                                "description": "测试单名称"
                            },
                            "build": {
                                "type": "integer",
                                "description": "提测构建/版本",
                                "format": "int32"
                            },
                            "execution": {
                                "type": "integer",
                                "description": "所属执行",
                                "format": "int32"
                            },
                            "type": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "类型(integrate 集成测试 | system 系统测试 | acceptance 验收测试 | performance 性能测试 | safety 安全测试)"
                            },
                            "owner": {
                                "type": "string",
                                "description": "负责人"
                            },
                            "status": {
                                "type": "string",
                                "description": "状态(wait 未开始 | doing 进行中 | done 已关闭 | blocked 被阻塞)"
                            },
                            "begin": {
                                "type": "string",
                                "description": "开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "结束日期"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            }
                        },
                        "required": [
                            "productID",
                            "name",
                            "build",
                            "begin",
                            "end"
                        ]
                    },
                },
            }, {
                name: 'update',
                display: '修改测试单',
                type: 'update',
                method: 'put',
                path: '/testtasks/{testtaskID}',
                resultType: 'object',
                pathParams: {
                    testtaskID: '测试单ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "测试单名称"
                            },
                            "build": {
                                "type": "integer",
                                "description": "提测构建/版本",
                                "format": "int32"
                            },
                            "execution": {
                                "type": "integer",
                                "description": "所属执行",
                                "format": "int32"
                            },
                            "type": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "类型(integrate 集成测试 | system 系统测试 | acceptance 验收测试 | performance 性能测试 | safety 安全测试)"
                            },
                            "owner": {
                                "type": "string",
                                "description": "负责人"
                            },
                            "status": {
                                "type": "string",
                                "description": "状态(wait 未开始 | doing 进行中 | done 已关闭 | blocked 被阻塞)"
                            },
                            "begin": {
                                "type": "string",
                                "description": "开始日期"
                            },
                            "end": {
                                "type": "string",
                                "description": "结束日期"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            }
                        },
                        "required": [
                            "name",
                            "build",
                            "begin",
                            "end"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除测试单',
                type: 'delete',
                method: 'delete',
                path: '/testtasks/{testtaskID}',
                resultType: 'text',
                pathParams: {
                    testtaskID: '测试单ID',
                },
                render: 'action',
            }
        ],
    },

    /* 发布模块 */
    {
        name: 'release',
        display: '发布',
        description: '发布管理，支持获取发布列表，支持获取产品下的发布、创建发布、修改发布、删除发布',
        actions: [
            {
                name: 'list',
                display: '获取发布列表，支持获取产品下的发布',
                type: 'list',
                method: 'get',
                path: '/{scope}/{scopeID}/releases',
                resultType: 'list',
                pagerGetter: 'pager',
                resultGetter: 'releases',
                pathParams: {
                    scope: {description: '发布范围', options: [{value: 'products', label: '产品'}]},
                    scopeID: '范围ID',
                },
            }, {
                name: 'create',
                display: '创建发布',
                type: 'create',
                method: 'post',
                path: '/releases',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "productID": {
                                "type": "integer",
                                "description": "所属产品",
                                "format": "int32"
                            },
                            "system": {
                                "type": "integer",
                                "description": "所属应用",
                                "format": "int32"
                            },
                            "name": {
                                "type": "string",
                                "description": "应用版本号"
                            },
                            "build": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "包含构建"
                            },
                            "status": {
                                "type": "string",
                                "description": "状态(wait 未开始 | normal 已发布 | fail 发布失败 | terminate 停止维护)"
                            },
                            "date": {
                                "type": "string",
                                "description": "计划发布日期"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            }
                        },
                        "required": [
                            "productID",
                            "system",
                            "name",
                            "build",
                            "date"
                        ]
                    },
                },
            }, {
                name: 'update',
                display: '修改发布',
                type: 'update',
                method: 'put',
                path: '/releases/{releasID}',
                resultType: 'object',
                pathParams: {
                    releasID: '发布ID',
                },
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "system": {
                                "type": "integer",
                                "description": "所属应用",
                                "format": "int32"
                            },
                            "name": {
                                "type": "string",
                                "description": "应用版本号"
                            },
                            "build": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "包含构建"
                            },
                            "status": {
                                "type": "string",
                                "description": "状态(wait 未开始 | normal 已发布 | fail 发布失败 | terminate 停止维护)"
                            },
                            "date": {
                                "type": "string",
                                "description": "计划发布日期"
                            },
                            "desc": {
                                "type": "string",
                                "description": "描述"
                            }
                        },
                        "required": [
                            "system",
                            "name",
                            "build",
                            "date"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除发布',
                type: 'delete',
                method: 'delete',
                path: '/releases/{releasID}',
                resultType: 'text',
                pathParams: {
                    releasID: '发布ID',
                },
                render: 'action',
            }
        ],
    },

    /* 附件模块 */
    {
        name: 'file',
        display: '附件',
        description: '附件管理，支持编辑附件，修改附件的名称、删除附件',
        actions: [
            {
                name: 'create',
                display: '编辑附件，修改附件的名称',
                type: 'create',
                method: 'post',
                path: '/files',
                resultType: 'object',
                requestBody: {
                    required: true,
                    type: 'object',
                    schema: {
                        "type": "object",
                        "properties": {
                            "fileName": {
                                "type": "string",
                                "description": "附件名称"
                            }
                        },
                        "required": [
                            "fileName"
                        ]
                    },
                },
            }, {
                name: 'delete',
                display: '删除附件',
                type: 'delete',
                method: 'delete',
                path: '/files/{fileID}',
                resultType: 'text',
                pathParams: {
                    fileID: '附件ID',
                },
                render: 'action',
            }
        ],
    }
];
