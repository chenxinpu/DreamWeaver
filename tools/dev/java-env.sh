#!/usr/bin/env bash
# 织梦 DreamWeaver · Java 工具链环境
#
# 用法：  . tools/dev/java-env.sh && cd apps/backend && ./mvnw spring-boot:run
#
# 说明：
#  - JDK 21：优先系统安装（java_home 可识别），回退到工作区内 .tools/jdk
#  - Maven 本地仓库与 wrapper 缓存都落在工作区内 .tools/（沙箱/权限友好，且不污染 ~/.m2）

if [ -n "${BASH_SOURCE[0]:-}" ]; then
  _dw_self="${BASH_SOURCE[0]}"
else
  _dw_self="$0"
fi
DW_ROOT="$(cd "$(dirname "$_dw_self")/../.." && pwd)"
unset _dw_self

# 1) JDK 21：优先用系统已安装的（/usr/libexec/java_home 可识别），否则回退到工作区内 .tools/jdk
JAVA_HOME=""
if [ -x /usr/libexec/java_home ]; then
  JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
fi
if [ -z "$JAVA_HOME" ]; then
  for candidate in "$DW_ROOT"/.tools/jdk/*/zulu-*.jdk/Contents/Home "$DW_ROOT"/.tools/jdk/*/Contents/Home; do
    if [ -x "$candidate/bin/javac" ]; then JAVA_HOME="$candidate"; break; fi
  done
fi
export JAVA_HOME
if [ -n "$JAVA_HOME" ]; then PATH="$JAVA_HOME/bin:$PATH"; fi

# 2) Maven 本地仓库 / wrapper 缓存都放在工作区内
export MAVEN_USER_HOME="$DW_ROOT/.tools/maven-home"
export MAVEN_OPTS="${MAVEN_OPTS:--Xmx512m}"

# mvnw 通过 MAVEN_ARGS 生效（Maven 3.9+ 支持）
dw_mvn_args="-Dmaven.repo.local=$DW_ROOT/.tools/m2"
case " ${MAVEN_ARGS:-} " in
  *"maven.repo.local"*) : ;;
  *) MAVEN_ARGS="${MAVEN_ARGS:-} $dw_mvn_args" ;;
esac
unset dw_mvn_args
export MAVEN_ARGS

export PATH DW_ROOT
