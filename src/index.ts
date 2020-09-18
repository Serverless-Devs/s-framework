import { Component } from '@serverless-devs/s-core';
import { DEFAULT } from './static';
const fse = require('fs-extra');
const path = require('path');

const {
  REGION,
  SERVICE,
  FUNCTION,
  TRIGGERS,
  DOMAINS
} = DEFAULT;

interface ProjectConfig {
  ProjectName: string;
}

interface CredentialsConfig {
  AccountID: string;
  AccessKeyID: string;
  AccessKeySecret: string;
}

interface LogConfig {
  LogStore: string
  Project: string
}

interface PropertiesConfig {
  Region?: string
  CodeUri: string
  Domains?: []
  Environment?: []
  Log?: LogConfig
  Detail: any
}

interface InputsContext {
  Bootstrap: any
  Project: ProjectConfig
  Credentials: CredentialsConfig
  Properties: PropertiesConfig
}

class Framework extends Component {

  constructor(id?: string) {
    super(id);
  }

  async deploy(inputs: InputsContext ) {

    console.log('Start deploying framework ...');

    // 导入FC组件
    const fc = await this.load('fc', 'Component');
    const { Project, Credentials, Properties } = inputs;

    const inputService = inputs.Properties.Detail ? inputs.Properties.Detail.Service || {} : {};
    const inputFunction = inputs.Properties.Detail ? inputs.Properties.Detail.Function || {} : {};
    const Service = Object.assign(SERVICE, fc.state.Service || {}, inputService || {});
    const Function = Object.assign(FUNCTION, fc.state.Function || {}, inputFunction || {});

    const region = Properties.Region || REGION;
    let needNewDomains = false;
    if ((region !== fc.state.Region) || (inputFunction.Name && fc.state.Function.Name !== inputFunction.Name) || (inputService.Name && fc.state.Service.Name !== inputService.Name)) {
      needNewDomains = true;
    }

    if (inputs.Properties.Log) {
      Service.Log = inputs.Properties.Log;
    }

    if (inputs.Properties.Environment) {
      Function.Environment = inputs.Properties.Environment;
    }

    if (inputs.Properties.Domains && inputFunction.Triggers) {
      /**
       *   如果Domains和Triggers同时出现：
       *   1. 系统没办法正确对应起关系
       *   2. 系统没办法做进一步的同步变更
       *   3. 逻辑将会变得混乱无比
       *   所以出现这样的情况，理论是需要提醒并且退出操作！
       */
      throw new Error('Properties.Domains and Properties.Detail.Function.Triggers cannot be set at the same time.');
    }

    const triggerUserConfigState = inputFunction.Triggers ? true : false;
    Function.Triggers = this.getTriggers(inputs.Properties.Domains, Function.Triggers, fc.state.Domains, needNewDomains);
    Function.CodeUri = inputs.Properties.CodeUri || './';

    console.log('Bootstrap processing ...');
    await this.handlerStartConfig(Function.CodeUri, inputs.Bootstrap.Content, inputs.Bootstrap.IsConfig);

    const state = await fc.deploy({
      State: fc.state,
      Credentials,
      Project,
      Properties: {
        Region: Properties.Region || REGION,
        Function,
        Service
      }
    });

    let autoDomain: any;
    let outputDomains: any = [];
    let outputTriggers: any = {};
    for (let triggerIndex = 0;triggerIndex < state.Triggers.length;triggerIndex++) {
      const tempDomains = state.Triggers[triggerIndex].Domains || [];
      const domains = typeof tempDomains === 'string' ? [tempDomains] : tempDomains;
      for (let domainIndex = 0;domainIndex < domains.length;domainIndex++) {
        if (domains[domainIndex].endsWith('.test.functioncompute.com')) {
          autoDomain = domains[domainIndex];
        }
        if (triggerUserConfigState) {
          outputTriggers[state.Triggers[triggerIndex]['Name']] = {
            'Protocols': state.Triggers[triggerIndex]['Type'],
            'Domains': state.Triggers[triggerIndex]['Domains']
          };
        } else {
          outputDomains.push(domains[domainIndex]);
        }
      }
    }

    fc.state = { Function, Service, Domains: autoDomain, Region: Properties.Region || REGION};

    await fc.save();

    // 格式化输出结果
    const output:any = {
      Region: Properties.Region || REGION,
      Service: state.Service,
      Function: state.Function
    };
    if (triggerUserConfigState) {
      output['Triggers'] = outputTriggers;
    } else {
      output['Domains'] = outputDomains.length === 1 ? outputDomains[0] : outputDomains;
    }

    console.log('Framework deployment completed.');

    return output;
  }

  async remove(inputs: InputsContext) {

    const fc = await this.load('fc', 'Component');
    const { Project, Credentials, Properties } = inputs;


    if (!Properties.Detail) {
      Properties.Detail = {};
    }

    Properties.Detail.Region = Properties.Region;
    Properties.Detail.Service = Object.assign(SERVICE, fc.state.Service || {}, Properties.Detail.Service || {});
    Properties.Detail.Function = Object.assign(FUNCTION, fc.state.Function || {}, Properties.Detail.Function || {});

    await fc.remove({
      Project,
      Credentials,
      Properties: Properties.Detail,
      State: fc.state,
      Args: {}
    });

    fc.state = {};
    await fc.save();
  }

  private async handlerStartConfig(codeUri: string, bootstrapConfig: any, isConfig?: boolean) {
    // 如果是文件，则不操作
    if (!await fse.lstatSync(codeUri).isDirectory()) {
      return;
    }
    // 不是文件，则进行Bootstrap的添加
    const bootstrapPath = path.resolve(`${codeUri}/bootstrap`);
    // 如果bootstrap已经存在，并且startConfig不存在，则不进行操作
    if (await fse.pathExists(bootstrapPath) && !isConfig) {
      return;
    }
    // 将bootstrap写入到项目
    // await fse.writeFile(bootstrapPath, `#!/usr/bin/env bash\n\nexport PORT=9000\nnpx hexo server -p $PORT -s`);
    await fse.writeFile(bootstrapPath, bootstrapConfig, {mode: '777', encoding: 'utf8'});
  }

  private getTriggers(propertiesDomains: any, functionTriggers: any, stateDomains: any, state: boolean) {

    /**
     * 1. 如果有下面有Triggers，则上面的自定义域名失效
     *    原因是，系统没办法判断用户到底需要使用那个Trigger对应上面的自定义域名
     * 2. 如果配置了自定义域名，那么就用用户配置的，如果没有配置，则使用系统生成的
     * 3. 为了防止系统生成的域名变化，此处应该额外记录上次的域名状态
     *
     * todo: 域名状态与域名变更，这一部分是蛮重要的，在后期需要添加
     * todo: 域名绑定是可以指定版本的，这一步骤，理论已经是默认支持的了，但是需要验证
     */

    // 准备默认triggers
    const tempTrigger = TRIGGERS;
    const tempDomainsDefault = DOMAINS;
    if (stateDomains) {
      tempDomainsDefault[0].Domain = stateDomains;
    }

    tempTrigger[0].Parameters.Domains = propertiesDomains || tempDomainsDefault;

    // 对functionTriggers进行检测，检测多个auto，返回报错
    let autoCount = 0;
    if (functionTriggers) {
      for (let i = 0; i < functionTriggers.length; i++) {
        /**
         *  默认为HTTP触发器
         *  todo: 未来可以考虑支持更多
         */
        functionTriggers[i].Type = 'HTTP';
        const tempDomains = functionTriggers[i].Parameters.Domains || [];
        for (let j = 0; j < tempDomains.length; j++) {
          if (tempDomains[j].Domain == stateDomains && state) {
            functionTriggers[i].Parameters.Domains[j].Domain = 'Auto';
          }
          if (String(tempDomains[j].Domain).toLowerCase() === 'auto' && !state) {
            autoCount = autoCount + 1;
            functionTriggers[i].Parameters.Domains[j].Domain = stateDomains;
          } else if (tempDomains[j].Domain && tempDomains[j].Domain.endsWith('.test.functioncompute.com')) {
            autoCount = autoCount + 1;
          }
          if (autoCount === 2) {
            throw new Error('Each function can only get one assigned domain name.');
          }
        }
      }
      return functionTriggers;
    }

    return tempTrigger;
  }
}

module.exports = Framework;