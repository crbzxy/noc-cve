import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const configPath = join(root, 'config', 'apps.json')
const publicPath = join(root, 'public', 'config', 'apps.json')

function springBoot17(framework, databases, librerias) {
  return {
    tecnologia: 'Java 17',
    framework,
    'base de datos': databases,
    librerias,
  }
}

function springBoot21(framework, databases, librerias) {
  return {
    tecnologia: 'Java 21',
    framework,
    'base de datos': databases,
    librerias,
  }
}

function springBoot8(framework, databases, librerias) {
  return {
    tecnologia: 'Java 8',
    framework,
    'base de datos': databases,
    librerias,
  }
}

function truOnline304(databases) {
  const librerias = ['spring-boot-starter-web', 'mssql-jdbc']
  if (databases.includes('Mongo 6')) librerias.push('spring-boot-starter-data-mongodb')
  if (databases.includes('Redis 7')) librerias.push('spring-boot-starter-data-redis')
  if (databases.includes('SQL 2019')) librerias.push('spring-boot-starter-data-jpa')
  return springBoot17('Spring boot 3.0.4', databases, librerias)
}

function truOnline302(databases) {
  const librerias = ['spring-boot-starter-web', 'mssql-jdbc', 'spring-boot-starter-data-redis', 'spring-boot-starter-data-jpa']
  return springBoot17('Spring boot 3.0.2', databases, librerias)
}

const centrosLibrerias = [
  'ajax-wrapper-comp_1.0rc1', 'angus-activation_2.0.2', 'angus-mail_2.0.4', 'common-mvn_5.1.2',
  'commons-collections_2.1', 'commons-dbcp2_2.9.0', 'commons-discovery_0.5', 'commons-lang_2.4',
  'commons-logging_1.0.2', 'commons-pool2_2.4.2', 'feign-core_11.10', 'feign-gson_11.10',
  'feign-slf4j_11.10', 'gson_2.8.9', 'itext_2.1.0', 'jackson-databind_2.17.1',
  'jackson-jakarta-rs-json-provider_2.17.1', 'jakarta.activation-api_2.1.3', 'jakarta.jws-api_2.1.0',
  'jakarta.mail-api_2.1.3', 'jakarta.servlet-api_6.0.0', 'jakarta.servlet.jsp.jstl_3.0.1',
  'jakarta.servlet.jsp.jstl-api_3.0.0', 'jakarta.ws.rs-api_3.1.0', 'jakarta.xml.bind-api_4.0.0',
  'jakarta.xml.ws-api_4.0.1', 'jasperreports_3.7.0', 'jasypt_1.7.1', 'jaxb-impl_4.0.0', 'jaxws-ri_4.0.2',
  'jaxws-rt_4.0.2', 'jdom_1.0', 'jersey-client_3.1.3', 'jersey-container-servlet_3.1.3', 'jersey-hk2_3.1.3',
  'jersey-server_3.1.3', 'jtds_1.2.2', 'junit_4.13.1', 'logback-classic_1.5.6', 'lombok_1.18.22',
  'poi_3.9', 'poi-ooxml_3.9', 'poi-scratchpad_3.9', 'RmiTruperOnline_1.0', 'RmiTruperServer_1.0',
  'sapjco3_1', 'spring-boot-starter-data-jpa_3.3.1', 'spring-boot-starter-thymeleaf_3.3.1',
  'spring-boot-starter-tomcat_3.3.1', 'spring-boot-starter-web_3.3.1', 'wsdl4j_1.6.2',
]

const recordatoriosLibrerias = [
  'spring-boot-starter-web 3.5.1', 'spring-boot-starter-actuator 3.5.1', 'spring-cloud-starter-config 4.3.0',
  'spring-cloud-starter-bootstrap 4.3.0', 'spring-cloud-starter-netflix-eureka-client 4.3.0',
  'spring-boot-starter-mail 3.5.1', 'spring-boot-starter-security 3.5.1', 'RecordatoriosCommons 1.20.0-SNAPSHOT',
  'spring-boot-devtools 3.5.1', 'spring-boot-starter-test 3.5.1', 'spring-boot-starter-data-jpa 3.5.1',
  'spring-boot-configuration-processor 3.5.1', 'mssql-jdbc 12.10.2.jre11', 'lombok 1.18.38', 'msal4j 1.10.1',
  'microsoft-graph 6.15.0', 'hazelcast 5.5.0', 'jjwt-api 0.11.5', 'jjwt-impl 0.11.5', 'jjwt-jackson 0.11.5',
  'jakarta.xml.bind-api 4.0.2', 'jxls-poi 3.1.0', 'jxls-reader 2.1.0', 'springdoc-openapi-starter-webmvc-ui 2.6.0',
  'micrometer-registry-prometheus 1.15.1', 'spring-boot-starter-webflux 3.5.1',
]

const telLibrerias = [
  'ajax-wrapper-comp_1.0', 'amqp-client_4.8.0', 'asm_4.0', 'axis_1.4', 'barbecue_1.5-beta1', 'classmexer_1.0',
  'common-mvn_5.1.3', 'commons-beanutils_1.5', 'commons-codec_1.8', 'commons-collections_3.2', 'commons-collections4_4.4',
  'commons-dbcp2_2.1.1', 'commons-digester_1.7', 'commons-discovery_0.5', 'commons-fileupload_1.3.2', 'commons-io_2.5',
  'commons-lang_2.4', 'commons-logging_1.0', 'commons-pool2_2.11.1', 'commons-text_1.4', 'core-renderer_1.0',
  'core-renderer-minimal_1.0', 'dom4j_1.6.1', 'easy-random-core_4.2.0', 'ehcache_2.10.9.2', 'feign-core_11.10',
  'feign-gson_11.10', 'feign-jackson_11.10', 'feign-okhttp_11.10', 'feign-slf4j_11.10', 'flying-saucer-pdf_9.1.20',
  'groovy-all_1.7.5', 'gson_2.3.1', 'guava_32.1.3-jre', 'hazelcast-spring_5.2.5', 'hibernate-core_5.6.15.Final',
  'itext_2.1.0', 'jackson-databind_2.9.4', 'jakarta.servlet.jsp.jstl_1.2.6', 'jasperreports_3.7.0', 'javax.el-api_3.0.0',
  'javax.persistence-api_2.2', 'javax.servlet-api_4.0.1', 'javax.servlet.jsp-api_2.3.3', 'javax.websocket-api_1.1',
  'jaxb-api_2.3.0', 'jaxrpc-api_1.1', 'jaxws-api_2.3.1', 'jcommon_1.0.16', 'jdom_1.0', 'jedis_4.3.1',
  'jersey-bundle_1.19', 'jersey-client_1.19', 'jersey-core_1.19', 'jersey-json_1.19', 'jersey-multipart_1.19.4',
  'jersey-server_1.19', 'jjwt_0.9.0', 'jsf-api_2.2.4', 'jsf-impl_2.2.4', 'jstl_1.2', 'jta_1.1', 'jtds_1.3.1',
  'junit_4.12', 'kryo_2.22', 'log4j_1.2.17', 'logback-classic_1.1.2', 'lombok_1.18.2', 'minlog_1.2', 'mockito-core_3.12.4',
  'mongodb-driver-legacy_4.6.1', 'mongodb-driver-sync_4.6.1', 'objenesis_1.2', 'ojdbc_14', 'opencsv_5.3', 'poi_3.9',
  'poi-excelant_3.9', 'poi-ooxml_3.9', 'poi-ooxml-schemas_3.9', 'poi-scratchpad_3.9', 'primefaces_7.0', 'quartz-all_1.6.3',
  'reflectasm_1.07', 'RmiTruperOnline_2.0', 'RmiTruperServer_1.0', 'rt-truper_1.0.0', 'sap-artifacts_1.15.0-SNAPSHOT',
  'sapjco3_1', 'spring-context_5.3.28', 'spring-context-support_5.3.28', 'spring-data-jpa_2.7.18',
  'spring-data-mongodb_3.4.18', 'spring-jdbc_5.3.28', 'spring-test_5.3.30', 'spring-tx_5.3.28', 'spring-web_5.3.28',
  'spring-webmvc_5.3.28', 'standard_1.1.0', 'thymeleaf_3.0.11.RELEASE', 'tomcat-dbcp_8.0.47', 'tomcat8jndi_1.0.0',
  'truper-commons-hazelcast_1.3.0-SNAPSHOT', 'truper-login_1.0', 'truper-utils_1.5.0', 'vavr_0.10.4', 'wsdl4j_1.6.2',
  'xmlbeans_2.6.0',
]

const apps = {
  Renglonaje: {
    tecnologia: 'Java 8',
    framework: 'Spring boot 2.7.1',
    'base de datos': ['Mongo 6', 'SQL 2019'],
    librerias: ['mssql-jdbc', 'spring-boot-starter-data-mongodb'],
  },
  RECOM: {
    tecnologia: 'Java 8',
    framework: 'Spring boot 2.3.04',
    'base de datos': ['SQL 2019'],
    librerias: ['mssql-jdbc'],
  },
  TLM: {
    tecnologia: 'Java 17',
    framework: 'Spring boot 3.04',
    'base de datos': ['SQL 2019'],
    librerias: ['mssql-jdbc'],
  },
  SRM: {
    tecnologia: 'Java 8',
    framework: 'Spring boot 2.5.3',
    'base de datos': ['SQL 2019'],
    librerias: ['mssql-jdbc'],
  },
  'Extractos Bancarios (batch-tel)': {
    tecnologia: 'Java 8',
    framework: 'Spring boot 2.2.6.RELEASE',
    'base de datos': ['SQL 2019'],
    librerias: ['mssql-jdbc'],
  },
  'Centros de Servicio': {
    tecnologia: 'Java 17',
    framework: 'Spring boot 3.3.1',
    'base de datos': ['SQL 2019'],
    librerias: centrosLibrerias,
  },
  Recordatorios: {
    tecnologia: 'Java 21',
    framework: 'Spring boot 3.5.1',
    'base de datos': ['SQL 2019'],
    librerias: recordatoriosLibrerias,
  },
  TEL: {
    tecnologia: 'Java 8',
    framework: 'Spring 5.3.28',
    'base de datos': ['Mongo 4.6.1', 'SQL 2019'],
    librerias: telLibrerias,
  },
  'truperenlinea-bonos': truOnline304(['SQL 2019', 'Redis 7']),
  'truperenlinea-cartera': truOnline304(['SQL 2019', 'Redis 7']),
  'truperenlinea-clientes': truOnline304(['Mongo 6', 'SQL 2019']),
  'truperenlinea-pagos': truOnline304(['SQL 2019']),
  'truperenlinea-pedidos': truOnline304(['SQL 2019', 'Redis 7']),
  'truperenlinea-planeacion': truOnline304(['SQL 2019', 'Redis 7']),
  'truperenlinea-planner-tienda': truOnline304(['SQL 2019']),
  'truperenlinea-productos': truOnline304(['SQL 2019', 'Mongo 6', 'Redis 7']),
  'truperenlinea-support': truOnline304(['Mongo 6', 'SQL 2019']),
  'truperenlinea-truput': truOnline304(['SQL 2019']),
  'truperenlinea-folios': truOnline304(['SQL 2019', 'Mongo 6']),
  'truperenlinea-pedidos-consumer': springBoot21('libre', ['SQL 2019', 'SAP'], ['sapjco3', 'mssql-jdbc']),
  'truperenlinea-pedidos-consumer-tel': springBoot21('Spring boot 3.4.5', ['SQL 2019', 'SAP'], [
    'spring-boot-starter-web', 'spring-boot-starter-data-jpa', 'mssql-jdbc', 'sapjco3',
  ]),
  'truperenlinea-pedidos-producer': springBoot21('Spring boot 3.4.5', ['SQL 2019'], [
    'spring-boot-starter-web', 'spring-boot-starter-data-jpa', 'mssql-jdbc',
  ]),
  'truperenlinea-search': springBoot21('Spring boot 3.4.13', ['SQL 2019', 'Mongo 6'], [
    'spring-boot-starter-web', 'spring-boot-starter-data-jpa', 'spring-boot-starter-data-mongodb', 'mssql-jdbc',
  ]),
  'truperenlinea-mayoristas': truOnline304(['SQL 2019']),
  'truperenlinea-mostradores': truOnline304(['SQL 2019']),
  'truperenlinea-security': truOnline304(['SQL 2019', 'Redis 7']),
  'truperenlinea-redis-usuarios': truOnline302(['SQL 2019', 'Redis 7']),
  'truperenlinea-reglas-comerciales': truOnline304(['SQL 2019', 'Mongo 6']),
  'truperenlinea-redis-batch': truOnline302(['SQL 2019', 'Redis 7']),
  'truperenlinea-redis-batch-planning': truOnline302(['SQL 2019', 'Redis 7']),
  'truperenlinea-redis-batch-reng': truOnline302(['SQL 2019', 'Redis 7']),
  'truperenlinea-redis-batch-reports': truOnline302(['SQL 2019', 'Redis 7']),
  'truperenlinea-redis-maps': springBoot8('Spring boot 2.5.3', ['SQL 2019', 'Redis 7'], [
    'spring-boot-starter-web', 'spring-boot-starter-data-redis', 'mssql-jdbc',
  ]),
  'truperenlinea-redis-productos-maps': truOnline302(['SQL 2019', 'Redis 7']),
  'truperenlinea-redis-existencias': springBoot8('Spring boot 2.5.3', [], ['spring-boot-starter-data-redis']),
  'truperenlinea-reglas-comerciales-batch': truOnline304(['SQL 2019', 'Redis 7']),
  'truperenlinea-commons-redis': springBoot17('Spring boot 3.0.5', ['Mongo 6'], ['spring-boot-starter-data-mongodb']),
  'truperenlinea-commons-sap': springBoot17('Spring boot 3.0.4', [], ['sapjco3']),
  'truperenlinea-commons-support': truOnline304(['SQL 2019']),
}

const payload = { apps }
const json = `${JSON.stringify(payload, null, 2)}\n`

writeFileSync(configPath, json, 'utf8')
mkdirSync(dirname(publicPath), { recursive: true })
writeFileSync(publicPath, json, 'utf8')

const count = Object.keys(apps).length
JSON.parse(json)
console.log(JSON.stringify({ count, configPath, publicPath }))
