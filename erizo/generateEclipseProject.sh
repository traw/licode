#!/usr/bin/env bash

set -e

BIN_DIR="build"
if [ -d $BIN_DIR ]; then
  cd $BIN_DIR
  # Set to Debug to be able to debug in Eclipse
  cmake -H./src -Bbuild/eclipse -G"Eclipse CDT4 - Unix Makefiles" -DCMAKE_BUILD_TYPE=Debug -DCOMPILE_EXAMPLES=ON 
  echo "Done"
  cd ..
else
  echo "Error, build directory does not exist, run generateProject.sh first"
fi
