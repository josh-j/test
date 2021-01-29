#include <iostream>
#include <string>
#include <vector>
#include <functional>
#include <variant>
#include <tuple>
using std::vector;

#include "main.h"


class DeclarativeInterface {
public:
};

template <class SIGNATURE> class Declarative;
template <class Ret, class... Args>
class Declarative<Ret(Args...)> : public DeclarativeInterface {
  // function
  // arguments
public:
  Declarative(const Declarative &) = delete;
  void operator=(const Declarative &) = delete;

  Declarative() {}
  virtual ~Declarative() {}
  std::function<Ret(Args...)> fn;
  std::tuple<Args...> params;
};

std::vector<std::function<void()>> functions;

void test1(int& a, int& b) {
  std::cout << a + b << std::endl;
  a += 5;
  b += 5;
}
void test2(std::string name) { std::cout << name << std::endl; }

void Declare_test1(int a, int b) {
  std::cout << a << " " << b << std::endl;

  // I need to save the arguments
  // save the function
  // Then later be able to loop through multiple functions and call the right arguments

  
  functions.push_back(std::bind(test1, a, b));
}
void Declare_test2(std::string name) {
  functions.push_back(std::bind(test2, name));
}

class DeclareInterface {
public:
    virtual void operator()() = 0;
};

class CDeclare_test1 : public DeclareInterface {
public:
    void operator()(int a, int b) {
        _pa = new int;
        _pb = new int;
        *_pa = a;
        *_pb = b;

        test1((*_pa), (*_pb));

    }
    virtual void operator()() {
        test1((*_pa), (*_pb));
    }
    int* _pa;
    int* _pb;

};

int main() {

  Declare_test1(5, 10);
  Declare_test2("hello");

  Declarative<void(int, int)> a;
  a.fn = std::bind(test1, 5, 10);
  a.params = std::make_tuple(5, 10);

  vector<DeclarativeInterface *> decls;

  for (auto i : functions) {
    i();
  }

  for (auto i : functions) {
    i();
  }
}
